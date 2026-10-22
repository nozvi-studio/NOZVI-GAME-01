import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { LAYOUT_TOKENS } from '../src/presentation/designTokens.ts';
import { computeDesignHeight, DESIGN_WIDTH } from '../src/presentation/viewport.ts';

const W = DESIGN_WIDTH;
const NO_SAFE = { top: 0, bottom: 0 };

/** Các tỉ lệ máy thật, quy sang chiều cao hệ toạ độ thiết kế. */
const SCREENS = {
  '9:16': computeDesignHeight(1080, 1920),
  '9:19.5': computeDesignHeight(1080, 2340),
  '9:21 (máy trong ảnh chụp)': computeDesignHeight(1080, 2460),
};

describe('computeLayout — bố cục dọc co giãn', () => {
  it('giữ nguyên artboard gốc trên màn 9:16 không có lề an toàn', () => {
    const l = computeLayout(W, SCREENS['9:16'], NO_SAFE);
    expect(l.headerBounds.y).toBe(0);
    expect(l.boardBounds.y).toBeCloseTo(LAYOUT_TOKENS.board.y);
    expect(l.trayBounds.y).toBeCloseTo(LAYOUT_TOKENS.tray.y);
    expect(l.bottomBarBounds.y).toBeCloseTo(LAYOUT_TOKENS.bottomBar.y);
  });

  it('bàn chơi không đổi kích thước trên mọi máy', () => {
    for (const height of Object.values(SCREENS)) {
      const l = computeLayout(W, height, NO_SAFE);
      expect(l.boardBounds.width).toBe(LAYOUT_TOKENS.board.width);
      expect(l.boardBounds.height).toBe(LAYOUT_TOKENS.board.height);
      expect(l.cellPixel).toBe(5);
    }
  });

  it.each(Object.entries(SCREENS))('thanh đáy chạm mép dưới trên %s', (_name, height) => {
    const l = computeLayout(W, height, NO_SAFE);
    expect(l.bottomBarBounds.y + l.bottomBarBounds.height).toBeCloseTo(height);
  });

  it.each(Object.entries(SCREENS))('không có gì tràn ra ngoài khung trên %s', (_name, height) => {
    const l = computeLayout(W, height, NO_SAFE);
    expect(l.headerBounds.y).toBeGreaterThanOrEqual(0);
    expect(l.boardBounds.y + l.boardBounds.height).toBeLessThanOrEqual(height);
    expect(l.trayBounds.y + l.trayBounds.height).toBeLessThanOrEqual(height);
  });

  it.each(Object.entries(SCREENS))('khay không chồng lên bàn hay thanh đáy trên %s', (_name, height) => {
    const l = computeLayout(W, height, NO_SAFE);
    expect(l.trayBounds.y).toBeGreaterThanOrEqual(l.boardBounds.y + l.boardBounds.height);
    expect(l.trayBounds.y + l.trayBounds.height).toBeLessThanOrEqual(l.bottomBarBounds.y);
  });

  it('màn càng dài thì khoảng thở quanh bàn càng rộng', () => {
    const short = computeLayout(W, SCREENS['9:16'], NO_SAFE);
    const tall = computeLayout(W, SCREENS['9:21 (máy trong ảnh chụp)'], NO_SAFE);
    const gapOf = (l: ReturnType<typeof computeLayout>) =>
      l.boardBounds.y - (l.headerBounds.y + l.headerBounds.height);
    expect(gapOf(tall)).toBeGreaterThan(gapOf(short));
  });

  it('bàn được căn giữa khoảng trống giữa header và khay', () => {
    const l = computeLayout(W, SCREENS['9:21 (máy trong ảnh chụp)'], NO_SAFE);
    const above = l.boardBounds.y - (l.headerBounds.y + l.headerBounds.height);
    const below = l.trayBounds.y - (l.boardBounds.y + l.boardBounds.height);
    expect(above).toBeCloseTo(below);
  });
});

describe('computeLayout — lề an toàn', () => {
  it('đẩy header xuống dưới notch và thanh đáy lên trên vùng vuốt', () => {
    const height = SCREENS['9:21 (máy trong ảnh chụp)'];
    const safe = { top: 96, bottom: 48 };
    const l = computeLayout(W, height, safe);

    expect(l.headerBounds.y).toBe(96);
    expect(l.bottomBarBounds.y + l.bottomBarBounds.height).toBeCloseTo(height - 48);
  });

  it('giữ mọi thứ trong vùng an toàn khi notch rất dày', () => {
    const height = SCREENS['9:19.5'];
    const safe = { top: 140, bottom: 90 };
    const l = computeLayout(W, height, safe);

    expect(l.headerBounds.y).toBeGreaterThanOrEqual(safe.top);
    expect(l.boardBounds.y).toBeGreaterThan(l.headerBounds.y + l.headerBounds.height);
    expect(l.bottomBarBounds.y + l.bottomBarBounds.height).toBeLessThanOrEqual(height - safe.bottom);
  });

  it('coi lề âm là không có lề', () => {
    const l = computeLayout(W, SCREENS['9:16'], { top: -20, bottom: -20 });
    expect(l.safeArea.top).toBe(0);
    expect(l.safeArea.bottom).toBe(0);
  });
});

describe('computeLayout — huy hiệu mục tiêu', () => {
  it('bám theo bàn chứ không đứng yên', () => {
    const short = computeLayout(W, SCREENS['9:16'], NO_SAFE);
    const tall = computeLayout(W, SCREENS['9:21 (máy trong ảnh chụp)'], NO_SAFE);

    expect(short.targetBadgeY).toBeCloseTo(178);
    expect(tall.targetBadgeY).toBeCloseTo(tall.boardBounds.y - 66);
    expect(tall.targetBadgeY).toBeGreaterThan(short.targetBadgeY);
  });

  it('đỉnh huy hiệu không trùm lên dòng phụ đề chương', () => {
    const radius = LAYOUT_TOKENS.targetBadge.radius;
    for (const height of Object.values(SCREENS)) {
      const l = computeLayout(W, height, NO_SAFE);
      // Phụ đề nằm ở headerTop + 74, cỡ chữ 24 -> mép dưới khoảng +86.
      const subtitleBottom = l.headerBounds.y + 86;
      expect(l.targetBadgeY - radius).toBeGreaterThanOrEqual(subtitleBottom - 4);
    }
  });
});
