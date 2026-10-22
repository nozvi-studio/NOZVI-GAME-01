export type TitleStyle = 'rise' | 'cross' | 'wheel' | 'converge' | 'split';

/** Milliseconds each phase of the centre-of-band title card lasts. */
export const TITLE_TIMING = { enterMs: 1100, holdMs: 2600, exitMs: 900 } as const;

/** Horizontal offset of the cyan and magenta copies before the prism title snaps together. */
export const SPLIT_OFFSET = 22;

export type LetterEntrance = { delayMs: number; fromX: number; fromY: number; fromAngle: number; fromScaleX: number; pivotY: number };

/**
 * Each chapter enters in the spirit of its name: Genesis rises, Intersections
 * cross, Rotations turn like a wheel, Convergence closes in, Prism splits into
 * colour and recombines.
 */
export function titleStyle(chapter: number): TitleStyle {
  if (chapter === 2) return 'cross';
  if (chapter === 3) return 'wheel';
  if (chapter === 4) return 'converge';
  if (chapter === 5) return 'split';
  return 'rise';
}

const WHEEL_STEP_MS = 70;
const WHEEL_PIVOT_Y = 190;
const CONVERGE_STEP_MS = 50;
const CONVERGE_SPREAD_X = 60;
const RISE_STEP_MS = 60;
const RISE_FROM_Y = 34;
const CROSS_STEP_MS = 50;
const CROSS_FROM_X = 150;
const MAX_DELAY_MS = TITLE_TIMING.enterMs - 1;

/** Where letter `index` of `count` starts, and when it begins to move into place. */
export function letterEntrance(style: TitleStyle, index: number, count: number): LetterEntrance {
  const centre = (count - 1) / 2;
  const base = { fromX: 0, fromY: 0, fromAngle: 0, fromScaleX: 1, pivotY: 0 };
  if (style === 'rise') return { ...base, delayMs: Math.min(index * RISE_STEP_MS, MAX_DELAY_MS), fromY: RISE_FROM_Y };
  if (style === 'cross') {
    return { ...base, delayMs: Math.min(index * CROSS_STEP_MS, MAX_DELAY_MS), fromX: (index % 2 === 0 ? -1 : 1) * CROSS_FROM_X };
  }
  if (style === 'wheel') {
    return { ...base, delayMs: Math.min(index * WHEEL_STEP_MS, MAX_DELAY_MS), fromAngle: -110, pivotY: WHEEL_PIVOT_Y };
  }
  if (style === 'converge') {
    return {
      ...base,
      delayMs: Math.min((centre - Math.abs(index - centre)) * CONVERGE_STEP_MS, MAX_DELAY_MS),
      fromX: (index - centre) * CONVERGE_SPREAD_X,
      fromScaleX: 2.4,
    };
  }
  return { ...base, delayMs: 0 };
}
