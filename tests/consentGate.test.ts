import { describe, expect, test } from 'vitest';
import { requestPrivacyChoices } from '../src/presentation/consent/consentGate.ts';

type El = {
  tag: string;
  attrs: Record<string, string>;
  textContent: string;
  type?: string;
  checked?: boolean;
  hidden?: boolean;
  href?: string;
  children: El[];
  listeners: Record<string, () => void>;
  style: { cssText: string };
  removed: boolean;
};

function fakeDoc() {
  const all: El[] = [];
  const make = (tag: string): El => {
    const el: El = { tag, attrs: {}, textContent: '', children: [], listeners: {}, style: { cssText: '' }, removed: false };
    Object.assign(el, {
      setAttribute: (k: string, v: string) => void (el.attrs[k] = v),
      append: (...c: El[]) => void el.children.push(...c),
      appendChild: (c: El) => void el.children.push(c),
      addEventListener: (ev: string, fn: () => void) => void (el.listeners[ev] = fn),
      remove: () => void (el.removed = true),
    });
    all.push(el);
    return el;
  };
  const body = make('body');
  const doc = { createElement: make, body } as unknown as Document;
  const byId = (id: string) => all.find((e) => e.attrs['data-id'] === id)!;
  return { doc, all, byId, overlay: () => body.children[0] };
}

const T = (key: string) => key;

describe('requestPrivacyChoices', () => {
  test('từ chối tất cả: tắt hết và gỡ lớp phủ', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['analytics', 'diagnostics'], doc: d.doc, translate: T });
    d.byId('reject').listeners.click();
    await expect(done).resolves.toEqual({ analytics: false, diagnostics: false });
    expect(d.overlay().removed).toBe(true);
  });

  test('đồng ý tất cả trên web chỉ bật báo lỗi', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['diagnostics'], doc: d.doc, translate: T });
    d.byId('accept').listeners.click();
    await expect(done).resolves.toEqual({ analytics: false, diagnostics: true });
  });

  test('chỉ hiện công tắc cho mục được đưa ra; Tùy chọn mở phần công tắc; Lưu theo công tắc', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['analytics'], doc: d.doc, translate: T });
    expect(d.all.some((e) => e.attrs['data-id'] === 'switch-diagnostics')).toBe(false);
    const panel = d.byId('options-panel');
    expect(panel.hidden).toBe(true);
    d.byId('options').listeners.click();
    expect(panel.hidden).toBe(false);
    d.byId('switch-analytics').checked = true;
    d.byId('save').listeners.click();
    await expect(done).resolves.toEqual({ analytics: true, diagnostics: false });
  });

  test('hai nút nhanh có cùng kiểu chữ và kích thước', () => {
    const d = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], doc: d.doc, translate: T });
    expect(d.byId('accept').style.cssText).toBe(d.byId('reject').style.cssText);
  });

  test('có URL thì hiện link chính sách, không có thì ẩn', () => {
    const withUrl = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], policyUrl: 'https://x.test/p', doc: withUrl.doc, translate: T });
    expect(withUrl.byId('policy').href).toBe('https://x.test/p');
    const without = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], doc: without.doc, translate: T });
    expect(without.all.some((e) => e.attrs['data-id'] === 'policy')).toBe(false);
  });
});
