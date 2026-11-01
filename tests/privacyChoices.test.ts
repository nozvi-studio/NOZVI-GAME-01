// tests/privacyChoices.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createPrivacyChoices, PRIVACY_STORAGE_KEY } from '../src/application/privacyChoices.ts';

function memory(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PRIVACY_STORAGE_KEY, initial);
  return { map, store: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('createPrivacyChoices', () => {
  test('mặc định tắt cả hai và chưa quyết định', () => {
    const c = createPrivacyChoices(memory().store, ids());
    expect(c.get()).toEqual({ analytics: false, diagnostics: false });
    expect(c.decided()).toBe(false);
  });

  test('set lưu xuống storage, đánh dấu đã quyết định, đọc lại đúng', () => {
    const m = memory();
    createPrivacyChoices(m.store, ids()).set({ analytics: true, diagnostics: false });
    const again = createPrivacyChoices(m.store, ids());
    expect(again.get()).toEqual({ analytics: true, diagnostics: false });
    expect(again.decided()).toBe(true);
  });

  test('userId ổn định giữa các lần mở', () => {
    const m = memory();
    const first = createPrivacyChoices(m.store, ids()).userId();
    expect(createPrivacyChoices(m.store, () => 'other').userId()).toBe(first);
  });

  test('rút lại thống kê thì tạo userId mới; bật lại thì giữ', () => {
    const c = createPrivacyChoices(memory().store, ids());
    c.set({ analytics: true });
    const before = c.userId();
    c.set({ analytics: false });
    const after = c.userId();
    expect(after).not.toBe(before);
    c.set({ analytics: true });
    expect(c.userId()).toBe(after);
  });

  test('chỉ đổi diagnostics thì không đổi userId', () => {
    const c = createPrivacyChoices(memory().store, ids());
    c.set({ analytics: true });
    const id = c.userId();
    c.set({ diagnostics: true });
    expect(c.userId()).toBe(id);
  });

  test('JSON hỏng hoặc sai kiểu thì coi như chưa quyết định', () => {
    expect(createPrivacyChoices(memory('{oops').store, ids()).decided()).toBe(false);
    expect(createPrivacyChoices(memory('{"analytics":"yes","decided":true}').store, ids()).get()).toEqual({
      analytics: false,
      diagnostics: false,
    });
  });

  test('storage ném lỗi thì vẫn chạy trong bộ nhớ', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    const c = createPrivacyChoices(broken, ids());
    c.set({ diagnostics: true });
    expect(c.get().diagnostics).toBe(true);
  });

  test('onChange báo trạng thái mới và hủy đăng ký được', () => {
    const c = createPrivacyChoices(memory().store, ids());
    const seen = vi.fn();
    const off = c.onChange(seen);
    c.set({ analytics: true });
    off();
    c.set({ analytics: false });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen).toHaveBeenCalledWith({ analytics: true, diagnostics: false });
  });

  test('listener ném lỗi không chặn listener khác', () => {
    const c = createPrivacyChoices(memory().store, ids());
    const ok = vi.fn();
    c.onChange(() => { throw new Error('x'); });
    c.onChange(ok);
    c.set({ analytics: true });
    expect(ok).toHaveBeenCalledOnce();
  });

  test('getItem ném lỗi thì không ghi đè bản đã lưu lúc khởi tạo', () => {
    const setItem = vi.fn();
    const c = createPrivacyChoices({ getItem: () => { throw new Error('read'); }, setItem }, ids());
    expect(setItem).not.toHaveBeenCalled();
    expect(c.decided()).toBe(false);
  });

  test('khóa đồng ý cũ nozvi.analytics.consent.v1 = granted bị bỏ qua', () => {
    const m = memory();
    m.map.set('nozvi.analytics.consent.v1', 'granted');
    const c = createPrivacyChoices(m.store, ids());
    expect(c.decided()).toBe(false);
    expect(c.get()).toEqual({ analytics: false, diagnostics: false });
  });
});
