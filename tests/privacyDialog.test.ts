import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivacyDialog } from '../src/presentation/dialogs/PrivacyDialog.ts';
import { shortId } from '../src/presentation/privacyServices.ts';
import { NO_ADS } from '../src/presentation/adsServices.ts';
import { t } from '../src/presentation/i18n.ts';
import { fakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

function choices(initial = { analytics: false, diagnostics: false, ads: false }) {
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
    expect(ui.items.some((i) => i.text === t('privacy_personalized_ads'))).toBe(false);
  });

  it('shows the offered ads toggle above UMP and saves each change', () => {
    const c = choices();
    const ui = fakeScene({
      ads: { ...NO_ADS, privacyOptionsRequired: () => true },
      privacy: { choices: c, offered: ['ads'] },
    });
    new PrivacyDialog(ui.scene).open();
    const row = ui.items.find((i) => i.text === t('privacy_personalized_ads'))!;
    const ump = ui.items.find((i) => i.text === t('privacy_ads'))!;
    expect(row).toBeDefined();
    expect(row.y).toBeLessThan(ump.y);
    ui.tap(200, row.y);
    expect(c.set).toHaveBeenLastCalledWith({ ads: true });
    ui.tap(200, row.y);
    expect(c.set).toHaveBeenLastCalledWith({ ads: false });
  });

  it('bấm công tắc ghi vào PrivacyChoices', async () => {
    const c = choices();
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: c, offered: ['analytics', 'diagnostics'] } });
    new PrivacyDialog(ui.scene).open();
    const row = ui.items.find((i) => i.text === t('privacy_analytics'))!;
    ui.tap(200, row.y);
    await Promise.resolve();
    expect(c.set).toHaveBeenCalledWith({ analytics: true });
    expect(ui.items.some((i) => i.text === t('privacy_withdraw_title'))).toBe(false);
  });

  it('shows and copies the full current ID before confirming withdrawal, then refreshes the ID row', async () => {
    const oldId = '01234567-89ab-cdef-0123-456789abcdef';
    const newId = 'fedcba98-7654-3210-fedc-ba9876543210';
    let id = oldId;
    const c = { ...choices({ analytics: true, diagnostics: false, ads: false }), userId: () => id };
    c.set.mockImplementation(() => { id = newId; });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: c, offered: ['analytics'] } });
    new PrivacyDialog(ui.scene).open();
    const idRow = ui.items.find((i) => i.text?.includes(shortId(oldId)))!;
    ui.tap(200, ui.items.find((i) => i.text === t('privacy_analytics'))!.y);
    expect(c.set).not.toHaveBeenCalled();
    const card = ui.items.find((i) => i.kind === 'container' && i.children.some((child) => child.text === t('privacy_withdraw_title')))!;
    expect(card).toBeDefined();
    expect(card.children.some((i) => i.text === oldId)).toBe(true);
    ui.tap(0, card.children.find((i) => i.text === t('privacy_copy'))!.y);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(oldId);
    expect(card.children.some((i) => i.text?.includes(t('privacy_copied')))).toBe(true);
    ui.tap(0, card.children.find((i) => i.text === t('privacy_withdraw_confirm'))!.y);
    await Promise.resolve();
    expect(c.set).toHaveBeenCalledOnce();
    expect(c.set).toHaveBeenCalledWith({ analytics: false });
    expect(card.destroyed).toBe(true);
    expect(idRow.text).toContain(shortId(newId));
    expect(idRow.text).not.toContain(shortId(oldId));
    ui.tap(0, idRow.y);
    await Promise.resolve();
    expect(writeText).toHaveBeenLastCalledWith(newId);
  });

  it.each(['cancel', 'close', 'backdrop'])('keeps statistics enabled after %s and allows retry', async (action) => {
    const c = choices({ analytics: true, diagnostics: false, ads: false });
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: c, offered: ['analytics'] } });
    new PrivacyDialog(ui.scene).open();
    const analytics = ui.items.find((i) => i.text === t('privacy_analytics'))!;
    ui.tap(200, analytics.y);
    const card = ui.items.filter((i) => i.kind === 'container').at(-1)!;
    if (action === 'cancel') ui.tap(0, card.children.find((i) => i.text === t('privacy_withdraw_cancel'))!.y);
    else if (action === 'close') {
      const close = card.children.find((i) => i.kind === 'zone' && i.width === 64)!;
      ui.tap(close.x, close.y);
    } else {
      const backdrop = card.children.find((i) => i.kind === 'rectangle')!;
      const panel = card.children.find((i) => i.kind === 'zone' && i.x === 0 && i.y === 0)!;
      const x = (panel.width + backdrop.width) / 4;
      expect(x).toBeGreaterThan(panel.width / 2);
      expect(x).toBeLessThan(backdrop.width / 2);
      ui.tap(x, 0);
    }
    await Promise.resolve();
    expect(c.set).not.toHaveBeenCalled();
    expect(c.get().analytics).toBe(true);
    expect(card.destroyed).toBe(true);
    ui.tap(200, analytics.y);
    expect(ui.items.filter((i) => i.text === t('privacy_withdraw_title'))).toHaveLength(2);
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
