import { STAR_PERCENTS } from '../../domain/starRating.ts';

/** Mockup (390 px wide) scaled by 720 / 390 into the 720-wide design space. */
const K = 720 / 390;

export const TIME_BAR = {
  // About 0.9 of the mockup and raised, so the target badge (top at y 102 on a 9:16 screen) never covers it.
  width: Math.round(216 * K),
  height: Math.round(12 * K),
  starSize: Math.round(22 * K),
  /** Centre of the bar and of the campaign subtitle, measured from the top of the header. */
  centerY: 70,
  subtitleY: 28,
  /** Star slots as a fraction of the bar width: mockup x = 125 / 197 / 269 plus half a star. */
  starFractions: [0.25, 0.55, 0.85] as const,
  fall: { dropPx: Math.round(16 * K), turn: 40, scale: 0.6, pop: 1.3 },
} as const;

export type TimeBarModel = {
  /** 1 = full, 0 = empty. */
  fill: number;
  color: number;
  /** Left to right; the right star falls first. */
  starsLeft: [boolean, boolean, boolean];
};

const GOLD = [0xff, 0xc8, 0x57] as const;
const ORANGE = [0xff, 0x9f, 0x45] as const;
const RED = [0xff, 0x5d, 0x7a] as const;

function mix(a: readonly number[], b: readonly number[], t: number): number {
  const c = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return (c(0) << 16) | (c(1) << 8) | c(2);
}

export function timeBarModel(elapsedMs: number, budgetMs: number): TimeBarModel {
  const f = Math.min(1, Math.max(0, budgetMs > 0 ? elapsedMs / budgetMs : 1));
  const color = f <= 0.7 ? mix(GOLD, ORANGE, f / 0.7) : mix(ORANGE, RED, (f - 0.7) / 0.3);
  const scaled = elapsedMs * 100;
  // STAR_PERCENTS = [15, 45, 75]; left star falls at 75 %, middle at 45 %, right at 15 %.
  const alive = (pct: number) => scaled < pct * budgetMs;
  return {
    fill: 1 - f,
    color,
    starsLeft: [alive(STAR_PERCENTS[2]), alive(STAR_PERCENTS[1]), alive(STAR_PERCENTS[0])],
  };
}

/** Ten-point star polygon, first vertex straight up; inner radius 0.48 of the outer (mockup). */
export function starPolygon(cx: number, cy: number, outer: number): Array<{ x: number; y: number }> {
  const inner = outer * 0.48;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}
