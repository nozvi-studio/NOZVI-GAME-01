import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivacyDialog } from '../src/presentation/dialogs/PrivacyDialog.ts';
import { shortId } from '../src/presentation/privacyServices.ts';
import { NO_ADS } from '../src/presentation/adsServices.ts';
import { t } from '../src/presentation/i18n.ts';
import { fakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

function choices(initial = { analytics: false, diagnostics: false }) {
  let state = { ...initial };
  return {
    get: () => state,
    set: vi.fn((next: Partial<typeof state>) => void (state = { ...state, ...next })),
    userId: () => '0123456789abcdef',
  };
}

describe('shortId', () => {
  it('giữ 4 ký tự đầu và cuối', () => {
    expect(shortId('0123456789abcdef')).toBe('0123…cdef');
    expect(shortId('abc')).toBe('abc');
  });
});

describe('PrivacyDialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('chỉ hiện công tắc cho mục được đưa ra', () => {
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(ui.scene).open();
    expect(ui.items.some((i) => i.text === t('privacy_diagnostics'))).toBe(true);
    expect(ui.items.some((i) => i.text === t('privacy_analytics'))).toBe(false);
  });

  it('bấm công tắc ghi vào PrivacyChoices', () => {
    const c = choices();
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: c, offered: ['analytics', 'diagnostics'] } });
    new PrivacyDialog(ui.scene).open();
    const row = ui.items.find((i) => i.text === t('privacy_analytics'))!;
    ui.tap(200, row.y);
    expect(c.set).toHaveBeenCalledWith({ analytics: true });
  });

  it('dòng quảng cáo chỉ hiện khi UMP yêu cầu và mở UMP', () => {
    const showPrivacyOptions = vi.fn(() => Promise.resolve());
    const hidden = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(hidden.scene).open();
    expect(hidden.items.some((i) => i.text === t('privacy_ads'))).toBe(false);

    const ui = fakeScene({
      ads: { ...NO_ADS, privacyOptionsRequired: () => true, showPrivacyOptions },
      privacy: { choices: choices(), offered: ['diagnostics'] },
    });
    new PrivacyDialog(ui.scene).open();
    const ads = ui.items.find((i) => i.text === t('privacy_ads'))!;
    ui.tap(-250, ads.y);
    expect(showPrivacyOptions).toHaveBeenCalledOnce();
  });

  it('hiện mã rút gọn khi có thống kê; không có thống kê thì không hiện mã', () => {
    const withGa = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['analytics'] } });
    new PrivacyDialog(withGa.scene).open();
    expect(withGa.items.some((i) => i.text?.includes('0123…cdef'))).toBe(true);
    const web = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(web.scene).open();
    expect(web.items.some((i) => i.text?.includes('0123…cdef'))).toBe(false);
  });

  it('mọi vùng chạm đủ lớn', () => {
    const ui = fakeScene({
      ads: { ...NO_ADS, privacyOptionsRequired: () => true },
      privacy: { choices: choices(), offered: ['analytics', 'diagnostics'], policyUrl: 'https://x.test/p' },
    });
    new PrivacyDialog(ui.scene).open();
    for (const control of ui.items.filter((i) => i.interactive && i.kind !== 'rectangle')) {
      expect(control.width).toBeGreaterThanOrEqual(64);
      expect(control.height).toBeGreaterThanOrEqual(64);
    }
  });

  it('dòng Copy: sao chép xong thì nhãn thêm privacy_copied', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['analytics'] } });
    new PrivacyDialog(ui.scene).open();
    const row = ui.items.find((i) => i.text?.includes('0123…cdef'))!;
    expect(row.text).not.toContain(t('privacy_copied'));
    ui.tap(0, row.y);
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledWith('0123456789abcdef');
    expect(row.text).toContain(t('privacy_copied'));
  });

  it('dòng chính sách mở bằng window.open noopener', () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const ui = fakeScene({
      ads: NO_ADS,
      privacy: { choices: choices(), offered: ['diagnostics'], policyUrl: 'https://x.test/p' },
    });
    new PrivacyDialog(ui.scene).open();
    ui.tap(0, ui.items.find((i) => i.text === t('privacy_policy'))!.y);
    expect(open).toHaveBeenCalledWith('https://x.test/p', '_blank', 'noopener');
  });
});
