import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../../src/presentation/board/layout.ts';
import { TIME_BAR } from '../../../src/presentation/hud/timeBarModel.ts';
import {
  computeDesignHeight,
  computeViewport,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  canvasSafeArea,
} from '../../../src/engine/core/viewport/viewport.ts';

/**
 * Ma trận màn hình: chạy trọn chuỗi viewport -> lề an toàn -> bố cục PlayScene
 * cho các loại máy thật và kiểm các bất biến bố cục. Kích thước là pixel CSS
 * (`innerWidth` x `innerHeight`), lề là `env(safe-area-inset-*)`.
 */
type Device = {
  name: string;
  w: number;
  h: number;
  dpr: number;
  inset?: { top: number; right: number; bottom: number; left: number };
};

const z = { top: 0, right: 0, bottom: 0, left: 0 };
const DEVICES: Device[] = [
  // iPhone
  { name: 'iPhone SE (Safari)', w: 375, h: 553, dpr: 2 },
  { name: 'iPhone SE (app)', w: 375, h: 667, dpr: 2, inset: { ...z, top: 20 } },
  { name: 'iPhone 14 (Safari, thanh công cụ)', w: 390, h: 664, dpr: 3, inset: { ...z, top: 47, bottom: 34 } },
  { name: 'iPhone 14 (app/toàn màn)', w: 390, h: 844, dpr: 3, inset: { ...z, top: 47, bottom: 34 } },
  { name: 'iPhone 15 Pro Max (Safari)', w: 430, h: 739, dpr: 3, inset: { ...z, top: 59, bottom: 34 } },
  { name: 'iPhone 15 Pro Max (app)', w: 430, h: 932, dpr: 3, inset: { ...z, top: 59, bottom: 34 } },
  { name: 'iPhone 14 ngang', w: 844, h: 390, dpr: 3, inset: { top: 0, right: 47, bottom: 21, left: 47 } },
  // iPad
  { name: 'iPad mini dọc', w: 744, h: 1133, dpr: 2, inset: { ...z, top: 24, bottom: 20 } },
  { name: 'iPad Air dọc (Safari)', w: 820, h: 1106, dpr: 2, inset: { ...z, top: 24, bottom: 20 } },
  { name: 'iPad Pro 12.9 dọc', w: 1024, h: 1366, dpr: 2, inset: { ...z, top: 24, bottom: 20 } },
  { name: 'iPad ngang', w: 1180, h: 820, dpr: 2, inset: { ...z, top: 24, bottom: 20 } },
  { name: 'iPad Split View 1/3', w: 320, h: 1106, dpr: 2, inset: { ...z, top: 24, bottom: 20 } },
  // Android
  { name: 'Android 9:16 cũ', w: 360, h: 640, dpr: 2 },
  { name: 'Android 20:9', w: 393, h: 873, dpr: 2.75, inset: { ...z, top: 24, bottom: 24 } },
  { name: 'Android 21:9 (Xperia)', w: 384, h: 896, dpr: 4, inset: { ...z, top: 28, bottom: 16 } },
  { name: 'Android dpr 3.5', w: 412, h: 915, dpr: 3.5, inset: { ...z, top: 40, bottom: 24 } },
  { name: 'Galaxy Fold gập', w: 280, h: 653, dpr: 3, inset: { ...z, top: 24 } },
  { name: 'Galaxy Fold mở', w: 673, h: 841, dpr: 2.6, inset: { ...z, top: 24 } },
  { name: 'Tablet Android dọc', w: 800, h: 1280, dpr: 1.5, inset: { ...z, top: 24, bottom: 48 } },
  // Desktop / web nhúng
  { name: 'Desktop 1080p', w: 1920, h: 969, dpr: 1 },
  { name: 'Desktop 125%', w: 1536, h: 730, dpr: 1.25 },
  { name: 'iframe ngang thấp', w: 800, h: 450, dpr: 1 },
];

function playLayout(d: Device) {
  const inset = d.inset ?? z;
  const vp = computeViewport(d.w, d.h, d.dpr, inset);
  const designH = computeDesignHeight(vp.bufferWidth, vp.bufferHeight);
  const safe = canvasSafeArea(inset, vp, d.w);
  return { vp, designH, safe, layout: computeLayout(DESIGN_WIDTH, designH, safe) };
}

describe('ma trận màn hình', () => {
  for (const d of DEVICES) {
    it(d.name, () => {
      const { vp, designH, safe, layout } = playLayout(d);
      const usable = designH - safe.top - safe.bottom;
      const board = layout.boardBounds;
      const tray = layout.trayBounds;
      const bar = layout.bottomBarBounds;

      // Canvas không rộng hơn cửa sổ và luôn có đủ 1280 đơn vị giữa hai lề.
      expect(vp.cssWidth).toBeLessThanOrEqual(d.w + 0.5);
      expect(usable).toBeGreaterThanOrEqual(DESIGN_HEIGHT - 1);
      // Thứ tự dọc: header -> bàn -> khay -> thanh đáy, không chồng nhau, không lọt vào lề.
      expect(layout.headerBounds.y).toBeGreaterThanOrEqual(safe.top - 0.01);
      expect(board.y + board.height).toBeLessThanOrEqual(tray.y + 0.01);
      expect(tray.y + tray.height).toBeLessThanOrEqual(bar.y + 0.01);
      expect(bar.y + bar.height).toBeLessThanOrEqual(designH - safe.bottom + 0.01);
      // Huy hiệu mục tiêu không đè lên thanh sao.
      const starBottom = layout.headerBounds.y + TIME_BAR.centerY + TIME_BAR.starSize / 2 + 3;
      expect(starBottom).toBeLessThan(layout.targetBadgeY - 76);
      // Lề ngang (màn ngang có tai thỏ) không cắt vào bàn.
      expect(board.x).toBeGreaterThanOrEqual(safe.left);
      expect(board.x + board.width).toBeLessThanOrEqual(DESIGN_WIDTH - safe.right);
    });
  }
});

describe('canvasSafeArea', () => {
  it('máy dpr 4: quy đổi theo dpr đã kẹp, không phình lề', () => {
    const inset = { top: 28, right: 0, bottom: 16, left: 0 };
    const vp = computeViewport(384, 896, 4, inset);
    const safe = canvasSafeArea(inset, vp, 384);
    expect(safe.top).toBeCloseTo((28 * DESIGN_WIDTH) / 384, 5);
  });

  it('màn ngang đóng khung: tai thỏ hai cạnh không lấn vào canvas', () => {
    const inset = { top: 0, right: 47, bottom: 21, left: 47 };
    const vp = computeViewport(844, 390, 3, inset);
    const safe = canvasSafeArea(inset, vp, 844);
    expect(safe.left).toBe(0);
    expect(safe.right).toBe(0);
  });
});
