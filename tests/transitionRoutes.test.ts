import { describe, expect, test } from 'vitest';
import { TRANSITION_TOKENS } from '../src/presentation/designTokens.ts';
import { stepsEndMs } from '../src/presentation/transitions/choreography.ts';
import {
  MAP_OUT_TO_MENU,
  MAP_OUT_TO_PLAY,
  MAP_SPECIAL,
  MENU_OUT_TO_MAP,
  MENU_OUT_TO_PLAY,
  MENU_SPECIAL,
  PLAY_OUT_LEAVE,
  PLAY_OUT_NEXT,
  PLAY_SPECIAL,
  mapIn,
  menuIn,
  playIn,
} from '../src/presentation/transitions/routes.ts';
import { STARDUST_MAX, burstAt, dustAt, planBurst, planStardust } from '../src/presentation/transitions/stardust.ts';

const R = TRANSITION_TOKENS.routes;
const center = { x: 360, y: 600 };

describe('phần vào kết thúc đúng tổng thời lượng tuyến', () => {
  test.each([
    ['menu-to-play', playIn('menu', center)],
    ['map-to-play', playIn('node', center, { x: 200, y: 700 })],
    ['next-level', playIn('next', center)],
    ['play-to-map', mapIn(400)],
    ['menu-to-map', mapIn(300)],
    ['play-to-menu', menuIn('play')],
    ['map-to-menu', menuIn('map')],
  ] as const)('%s', (route, steps) => {
    expect(stepsEndMs(steps)).toBe(R[route].totalMs);
    for (const s of steps) expect(s.atMs).toBeGreaterThanOrEqual(R[route].handoffMs);
  });
});

describe('phần ra nằm trong tổng; next-level xong trước handoff', () => {
  test.each([
    ['menu-to-play', MENU_OUT_TO_PLAY],
    ['menu-to-map', MENU_OUT_TO_MAP],
    ['map-to-play', MAP_OUT_TO_PLAY],
    ['map-to-menu', MAP_OUT_TO_MENU],
    ['play-to-map', PLAY_OUT_LEAVE],
    ['next-level', PLAY_OUT_NEXT],
  ] as const)('%s', (route, steps) => {
    expect(stepsEndMs(steps)).toBeLessThanOrEqual(R[route].totalMs);
  });

  test('next-level: bước và hiệu ứng đặc biệt xong trước mốc restart 800', () => {
    const handoff = R['next-level'].handoffMs;
    expect(stepsEndMs(PLAY_OUT_NEXT)).toBeLessThanOrEqual(handoff);
    expect(PLAY_SPECIAL.dustAtMs + PLAY_SPECIAL.dustMs).toBeLessThanOrEqual(handoff);
    expect(PLAY_SPECIAL.flashAtMs + PLAY_SPECIAL.flashMs).toBeLessThanOrEqual(handoff);
  });
});

describe('hiệu ứng đặc biệt nằm trong tuyến', () => {
  test('Play vào', () => {
    const total = R['menu-to-play'].totalMs;
    expect(PLAY_SPECIAL.gridRevealAtMs + PLAY_SPECIAL.gridRevealMs).toBeLessThanOrEqual(total);
    expect(PLAY_SPECIAL.targetsAtMs + PLAY_SPECIAL.targetsSpanMs + PLAY_SPECIAL.targetsMs).toBe(1150);
    expect(PLAY_SPECIAL.glintAtMs + PLAY_SPECIAL.glintMs).toBe(1150);
    expect(PLAY_SPECIAL.zoomAtMs).toBeGreaterThanOrEqual(R['menu-to-play'].handoffMs);
  });

  test('Menu và Bản đồ ra', () => {
    expect(MENU_SPECIAL.spinAtMs + MENU_SPECIAL.spinMs).toBe(700);
    expect(MAP_SPECIAL.ringMs).toBe(450);
  });
});

describe('khung bia từ node: lệch đúng về điểm chạm', () => {
  test('dx, dy là khoảng từ tâm bia tới node', () => {
    const board = playIn('node', center, { x: 200, y: 700 }).find((s) => s.part === 'board')!;
    expect(board.delta).toEqual({ dx: -160, dy: 100, scale: 0.2, alpha: 0 });
  });

  test('next-level không chạy lại bia, lưới hay rune', () => {
    const parts = playIn('next', center).map((s) => s.part);
    expect(parts).not.toContain('board');
    expect(parts).not.toContain('runes');
  });
});

describe('bụi sao', () => {
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  test('không quá 30 hạt, alpha cố định trong [0.7, 1]', () => {
    const ps = planStardust([{ x: 100, y: 100 }, { x: 500, y: 300 }], center, 99, seq([0.1, 0.5, 0.9]));
    expect(ps).toHaveLength(STARDUST_MAX);
    for (const p of ps) {
      expect(p.alpha).toBeGreaterThanOrEqual(0.7);
      expect(p.alpha).toBeLessThanOrEqual(1);
      expect(p.x1).toBe(center.x);
      expect(p.y1).toBe(center.y);
    }
  });

  test('không có nguồn thì không có hạt', () => {
    expect(planStardust([], center, 30)).toEqual([]);
  });

  test('dustAt: mờ ở hai đầu, tới tâm khi t = 1', () => {
    const [p] = planStardust([{ x: 0, y: 0 }], center, 1, seq([0.5]));
    expect(dustAt(p, 0).alpha).toBeCloseTo(0, 9);
    expect(dustAt(p, 1).alpha).toBeCloseTo(0, 9);
    expect(dustAt(p, 0.5).alpha).toBeCloseTo(p.alpha, 9);
    expect(dustAt(p, 1).x).toBe(center.x);
  });

  test('planBurst: bung từ tâm ra ngoài trong 40–200 px, alpha cố định, tối đa 30', () => {
    const ps = planBurst(center, 99, seq([0.25, 0.5, 0.75]));
    expect(ps).toHaveLength(STARDUST_MAX);
    for (const p of ps) {
      expect(p.x0).toBe(center.x);
      const d = Math.hypot(p.x1 - center.x, p.y1 - center.y);
      expect(d).toBeGreaterThanOrEqual(40);
      expect(d).toBeLessThanOrEqual(200);
    }
    expect(burstAt(ps[0], 1).alpha).toBe(0);
    expect(burstAt(ps[0], 0).alpha).toBe(ps[0].alpha);
  });
});
