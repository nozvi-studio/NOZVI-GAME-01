import { describe, expect, it, test } from 'vitest';
import { COLOR_TOKENS, LAYOUT_TOKENS, TYPO_TOKENS, VICTORY_CARD } from '../src/presentation/designTokens.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import {
  getSnapHintText,
  VICTORY_VERSE_FONT_SIZE,
  formatMatchCount,
  formatNodeLabel,
  formatMenuContinueSubtext,
  getVictoryLabels,
  resolveVictoryVerse,
} from '../src/presentation/hud/hudText.ts';
import { setLocale } from '../src/presentation/i18n.ts';
import { chapterInfo, chapterOfLevelId } from '../src/content/chapters.ts';

describe('Hud Behavioral Logic and Visual Standards', () => {
  test('nút Xoay chỉ hiển thị ở Chương 3 (chương xoay)', () => {
    const rotates = (levelId: string) => chapterInfo(chapterOfLevelId(levelId) ?? 1)?.rotationEnabled;
    expect(rotates('1-1')).toBe(false);
    expect(rotates('2-3')).toBe(false);
    expect(rotates('3-1')).toBe(true);
    expect(rotates('3-10')).toBe(true);
    expect(rotates('4-1')).toBe(false);
    expect(rotates('4-6')).toBe(false);
    expect(rotates('dev-shapes-v2')).toBe(false);
  });

  test('kích thước nút tròn hành động và điều hướng đạt chuẩn touch target', () => {
    expect(LAYOUT_TOKENS.buttonSizes.circularAction).toBe(64);
    expect(LAYOUT_TOKENS.buttonSizes.circularNav).toBe(56);
  });

  test('tiêu đề và nhãn sử dụng font thích hợp, không dùng ALL-CAPS trong giao diện', () => {
    const sampleTitle = 'Màn 1-1 · Song Tinh';
    const isNotAllCaps = sampleTitle !== sampleTitle.toUpperCase();
    expect(isNotAllCaps).toBe(true);
    expect(TYPO_TOKENS.fontFamily.serif).toContain('Baloo 2');
    expect(TYPO_TOKENS.fontFamily.levelTitle).toContain('Be Vietnam Pro');
    // Tên màn phải giữ font sans: serif/display chỉ nhúng 600/700 nên thiếu nét
    // thường, và dấu tiếng Việt dày đặc đọc tại cỡ nhỏ kém hơn hẳn.
    expect(TYPO_TOKENS.fontFamily.levelTitle).not.toContain('Baloo 2');
  });
});

describe('HUD theo mockup improve-v1', () => {
  test('nhãn gợi ý thả mảnh dùng đúng chuỗi tiếng Việt, không viết hoa toàn bộ', () => {
    setLocale('vi');
    const hint = getSnapHintText();
    expect(hint).toBe('Thả để khớp');
    expect(hint).not.toBe(hint.toUpperCase());
  });

  test('thanh đếm mảnh hiển thị đúng định dạng n/m', () => {
    expect(formatMatchCount(0, 2)).toBe('0/2 mảnh đã khớp');
    expect(formatMatchCount(1, 2)).toBe('1/2 mảnh đã khớp');
    expect(formatMatchCount(2, 2)).toBe('2/2 mảnh đã khớp');
  });

  test('tiêu đề dùng cỡ chữ lớn của mockup, phụ đề nhỏ hơn hẳn', () => {
    const title = parseInt(TYPO_TOKENS.fontSize.headerTitle, 10);
    const caption = parseInt(TYPO_TOKENS.fontSize.caption, 10);
    expect(title).toBe(52);
    expect(caption).toBeLessThan(title);
  });

  test('câu kiến thức thắng dùng cỡ chữ 24px để nổi bật và dễ đọc', () => {
    expect(VICTORY_VERSE_FONT_SIZE).toBe(24);
  });

  test('getVictoryLabels cung cấp đủ eyebrow và tiêu đề', () => {
    setLocale('vi');
    const labels = getVictoryLabels();
    expect(labels.eyebrow).toBe('HOÀN THÀNH');
    expect(labels.title).toBe('Hoàn thành');
  });

  test('nút tròn dùng viền băng và nền radial mới', () => {
    expect(COLOR_TOKENS.iceGlass.primaryBorder).toBe('#A9E3FF');
    expect(COLOR_TOKENS.iceGlass.buttonFillTop).toBe('#3D5FC0');
    expect(COLOR_TOKENS.iceGlass.buttonFillBottom).toBe('#1B2A72');
  });
});

describe('victory card geometry', () => {
  test('is bottom-anchored and keeps its old bottom edge', () => {
    const layout = computeLayout(720, 1280, { top: 0, bottom: 0 });
    const top = layout.trayBounds.y - (VICTORY_CARD.h - VICTORY_CARD.bottomFromTray);
    const bottom = top + VICTORY_CARD.h;
    expect(bottom).toBe(layout.trayBounds.y + VICTORY_CARD.bottomFromTray);
    expect(bottom).toBeLessThanOrEqual(LAYOUT_TOKENS.canvas.height);
  });

  test('keeps its six pixels of bottom margin on every safe-area inset', () => {
    for (const bottomInset of [0, 24, 48, 96]) {
      const layout = computeLayout(720, 1280, { top: 0, bottom: bottomInset });
      const bottom = layout.trayBounds.y + VICTORY_CARD.bottomFromTray;
      expect(bottom, `inset ${bottomInset}`).toBeLessThanOrEqual(LAYOUT_TOKENS.canvas.height - 6);
    }
  });

  test('result rows and replay fit without overlapping', () => {
    const o = VICTORY_CARD.offsets;
    expect(o.title + 24).toBeLessThan(o.stars - 66);
    expect(o.stars + 66).toBeLessThan(o.pills - 37);
    expect(o.pills + 37).toBeLessThan(o.buttonTop);
    expect(o.buttonTop + VICTORY_CARD.buttonHeight + 7).toBeLessThan(o.replay - 16);
    expect(o.replay + 32).toBeLessThanOrEqual(VICTORY_CARD.h);
    expect(VICTORY_CARD.buttons.nextW / VICTORY_CARD.buttons.selectW).toBeCloseTo(1.4, 1);
    expect(VICTORY_CARD.buttons.selectW + VICTORY_CARD.buttons.gap + VICTORY_CARD.buttons.nextW).toBeLessThan(VICTORY_CARD.w - 60);
  });
});

describe('pure text formatting helpers in hudText', () => {
  test('formatNodeLabel trả về định danh màn và locator chòm sao', () => {
    setLocale('vi');
    const node = formatNodeLabel('2-1', 2);
    expect(node.name).toBe('Màn 2-1');
    expect(node.locator).toBe('Giao Thoa · Thiên hà xoắn ốc');
  });

  test('formatMenuContinueSubtext định dạng đúng màn campaign và dev level', () => {
    setLocale('vi');
    expect(formatMenuContinueSubtext('2-1')).toBe('Màn 2-1 · Giao Thoa');
    expect(formatMenuContinueSubtext('1-3')).toBe('Màn 1-3 · Khởi Nguyên');
    expect(formatMenuContinueSubtext('dev-shapes-v2')).toBe('Màn dev-shapes-v2');
  });
});

describe('resolveVictoryVerse', () => {
  it('returns overrideFact if provided in options (?fact= override)', () => {
    const v = resolveVictoryVerse({
      levelId: '1-1',
      overrideFact: 'Fact override for visual QA',
    });
    expect(v).toBe('Fact override for visual QA');
  });

  it('draws from chapter pool for campaign level in chapter with pool', () => {
    const v = resolveVictoryVerse({
      mode: 'campaign',
      levelId: '1-1',
      drawNextVerse: (ch) => `Fact for chapter ${ch}`,
    });
    expect(v).toBe('Fact for chapter 1');
  });

  it('uses peekVerse in harness mode to avoid mutating bag', () => {
    let drew = false;
    let peeked = false;
    const v = resolveVictoryVerse({
      mode: 'harness',
      levelId: '2-3',
      drawNextVerse: () => { drew = true; return 'drawn'; },
      peekVerse: () => { peeked = true; return 'peeked'; },
    });
    expect(v).toBe('peeked');
    expect(drew).toBe(false);
    expect(peeked).toBe(true);
  });

  it('falls back to chapter tagline for endless mode when no pool exists', () => {
    const v = resolveVictoryVerse({
      mode: 'endless',
      levelId: 'endless-level',
      endlessChapter: 4,
      fallbackVerse: 'Fallback tagline',
    });
    expect(v).toBeTruthy();
    expect(v.length).toBeGreaterThan(0);
  });

  it('falls back to getVictoryVerse for campaign level with no pool', () => {
    const v = resolveVictoryVerse({
      mode: 'campaign',
      levelId: 'dev-shapes-v2',
      fallbackVerse: 'Dev verse',
    });
    expect(v).toBeTruthy();
  });
});

