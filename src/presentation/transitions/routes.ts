import type { Step } from './choreography.ts';

export type Point = { x: number; y: number };

// ---------- Menu (spec F1 mục 3.1, 3.4, 3.5) ----------
// Part: emblem, titleBlock, primaryButton, buttons (chính + phụ),
// chrome (tiêu đề, nút phụ, cài đặt, footer), corner (cài đặt, footer).

export const MENU_OUT_TO_PLAY: readonly Step[] = [
  { part: 'primaryButton', atMs: 0, durationMs: 350, delta: { scale: 0.9, alpha: 0 } },
  { part: 'chrome', atMs: 0, durationMs: 170, delta: { dy: -24, alpha: 0 }, spanMs: 180 },
  { part: 'emblem', atMs: 200, durationMs: 500, delta: { dy: 100, scale: 2.2, alpha: 0 }, ease: 'cubicInOut' },
];

export const MENU_OUT_TO_MAP: readonly Step[] = [
  { part: 'emblem', atMs: 0, durationMs: 500, delta: { dy: -380, scale: 0.3, alpha: 0 }, ease: 'cubicInOut' },
  { part: 'chrome', atMs: 0, durationMs: 200, delta: { dy: -24, alpha: 0 }, spanMs: 180 },
  { part: 'primaryButton', atMs: 60, durationMs: 200, delta: { dy: -24, alpha: 0 } },
];

/** Vòng ấn Song Tinh quay nhanh gấp 4 khi đi vào màn chơi */
export const MENU_SPECIAL = { spinAtMs: 200, spinMs: 500, spinPeak: 4 } as const;

export function menuIn(from: 'map' | 'play'): Step[] {
  const emblem: Step = from === 'map'
    ? { part: 'emblem', atMs: 300, durationMs: 500, delta: { dy: -380, scale: 0.3, alpha: 0 }, ease: 'cubicInOut' }
    : { part: 'emblem', atMs: 400, durationMs: 500, delta: { scale: 0.6, alpha: 0 }, ease: 'backOut' };
  return [
    emblem,
    { part: 'titleBlock', atMs: 400, durationMs: 400, delta: { dy: -24, alpha: 0 } },
    { part: 'buttons', atMs: 500, durationMs: 420, delta: { dy: 24, alpha: 0 }, spanMs: 80 },
    { part: 'corner', atMs: 600, durationMs: 400, delta: { alpha: 0 } },
  ];
}

// ---------- Bản đồ (spec F1 mục 3.2, 3.4, 3.5) ----------
// Part: header, nodes (xếp theo khoảng cách tới node mốc), tappedNode,
// otherNodes, links (đường nối, đốm sáng, tiêu đề chương).

/** `startMs` là 300 khi từ Menu, 400 khi từ Play; mọi bước kết thúc ở 1000. */
export function mapIn(startMs: number): Step[] {
  return [
    { part: 'header', atMs: startMs, durationMs: 400, delta: { dy: -40, alpha: 0 } },
    {
      part: 'nodes',
      atMs: startMs + 100,
      durationMs: 300,
      delta: { scale: 0, alpha: 0 },
      ease: 'backOut',
      spanMs: 600 - startMs,
    },
    { part: 'links', atMs: startMs + 100, durationMs: 900 - startMs, delta: { alpha: 0 } },
  ];
}

export const MAP_OUT_TO_PLAY: readonly Step[] = [
  { part: 'tappedNode', atMs: 0, durationMs: 300, delta: { scale: 1.4 }, ease: 'backOut' },
  { part: 'tappedNode', atMs: 300, durationMs: 150, delta: { alpha: 0 } },
  { part: 'otherNodes', atMs: 0, durationMs: 250, delta: { alpha: 0 }, spanMs: 200 },
  { part: 'header', atMs: 0, durationMs: 300, delta: { dy: -40, alpha: 0 } },
  { part: 'links', atMs: 0, durationMs: 300, delta: { alpha: 0 } },
];

export const MAP_OUT_TO_MENU: readonly Step[] = [
  { part: 'header', atMs: 0, durationMs: 300, delta: { dy: -40, alpha: 0 } },
  { part: 'nodes', atMs: 0, durationMs: 200, delta: { alpha: 0 }, spanMs: 250 },
  { part: 'links', atMs: 0, durationMs: 450, delta: { alpha: 0 } },
];

/** Vòng sáng lan từ node vừa bấm tới bao trọn tấm bia */
export const MAP_SPECIAL = { ringStartRadius: 40, ringMs: 450 } as const;

// ---------- Play (spec F1 mục 3.1–3.4) ----------
// Part: board (đế bia, lưới, nắp bia), runes, rings, tray (khung + ô),
// trayPieces, pieces, targets, title, topButtons, bottomBar, winCard.

export function playIn(variant: 'menu' | 'node' | 'next', center: Point, origin?: Point): Step[] {
  const steps: Step[] = [];
  if (variant === 'menu' || (variant === 'node' && !origin)) {
    steps.push({ part: 'board', atMs: 350, durationMs: 450, delta: { scale: 0.85, alpha: 0 }, ease: 'backOut' });
  } else if (variant === 'node' && origin) {
    steps.push({
      part: 'board',
      atMs: 350,
      durationMs: 500,
      delta: { dx: origin.x - center.x, dy: origin.y - center.y, scale: 0.2, alpha: 0 },
    });
  }
  if (variant !== 'next') {
    steps.push(
      { part: 'rings', atMs: 350, durationMs: 450, delta: { alpha: 0 } },
      { part: 'runes', atMs: 500, durationMs: 200, delta: { alpha: 0 }, spanMs: 180 }
    );
  }
  steps.push(
    { part: 'tray', atMs: 950, durationMs: 300, delta: { dy: 40, alpha: 0 } },
    // Từng mảnh rơi vào ô khay: y −60 → 0, scale 0.6 → 1, so le (spec F1 mục 3.1)
    { part: 'trayPieces', atMs: 950, durationMs: 220, delta: { dy: -60, scale: 0.6, alpha: 0 }, ease: 'backOut', spanMs: 180 },
    { part: 'title', atMs: 1100, durationMs: 340, delta: { dy: -40, alpha: 0 }, spanMs: 60 },
    { part: 'topButtons', atMs: 1100, durationMs: 400, delta: { alpha: 0, scale: 0.8 }, ease: 'backOut' },
    { part: 'bottomBar', atMs: 1150, durationMs: 290, delta: { dy: 40, alpha: 0 }, spanMs: 60 }
  );
  return steps;
}

export const PLAY_OUT_NEXT: readonly Step[] = [
  { part: 'winCard', atMs: 0, durationMs: 300, delta: { dy: 60, alpha: 0 } },
  { part: 'pieces', atMs: 100, durationMs: 500, delta: { alpha: 0 } },
  { part: 'targets', atMs: 100, durationMs: 400, delta: { alpha: 0 } },
  { part: 'title', atMs: 300, durationMs: 400, delta: { dy: -40, alpha: 0 }, spanMs: 60 },
  { part: 'topButtons', atMs: 300, durationMs: 400, delta: { alpha: 0 } },
];

export const PLAY_OUT_LEAVE: readonly Step[] = [
  { part: 'title', atMs: 0, durationMs: 250, delta: { dy: -40, alpha: 0 }, spanMs: 60 },
  { part: 'topButtons', atMs: 0, durationMs: 250, delta: { alpha: 0 } },
  { part: 'bottomBar', atMs: 0, durationMs: 250, delta: { dy: 40, alpha: 0 }, spanMs: 60 },
  { part: 'winCard', atMs: 0, durationMs: 250, delta: { dy: 40, alpha: 0 } },
  { part: 'pieces', atMs: 0, durationMs: 250, delta: { alpha: 0 } },
  { part: 'targets', atMs: 0, durationMs: 200, delta: { alpha: 0 } },
  { part: 'tray', atMs: 50, durationMs: 300, delta: { dy: 40, alpha: 0 } },
  { part: 'rings', atMs: 0, durationMs: 300, delta: { alpha: 0 } },
  { part: 'board', atMs: 200, durationMs: 250, delta: { scale: 0.9, alpha: 0 } },
];

export const PLAY_SPECIAL = {
  zoomAtMs: 350,
  zoomMs: 450,
  zoomPeak: 1.03,
  gridRevealAtMs: 450,
  gridRevealMs: 450,
  gridRevealRadius: 520,
  targetsAtMs: 800,
  targetsSpanMs: 160,
  targetsMs: 190,
  glintAtMs: 800,
  glintMs: 350,
  dustAtMs: 100,
  dustMs: 600,
  flashAtMs: 500,
  flashMs: 300,
} as const;
