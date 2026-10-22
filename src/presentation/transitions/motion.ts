import { ANIM_TOKENS, FEEDBACK_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';

export type RouteId = keyof typeof TRANSITION_TOKENS.routes;

export type EaseName =
  | 'linear'
  | 'cubicOut'
  | 'cubicInOut'
  | 'quartOut'
  | 'backOut'
  | 'sineInOut'
  | 'anticipateOut';

/** Hàm easing thuần, t trong [0, 1]. Tự viết để test được mà không cần Phaser. */
export const EASES: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  quartOut: (t) => 1 - (1 - t) ** 4,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  anticipateOut: (t) => {
    const { pickupDipLift: dip, pickupDipAt: at } = FEEDBACK_TOKENS;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t <= at) return dip * EASES.cubicOut(t / at);
    return dip + (1 - dip) * EASES.cubicOut((t - at) / (1 - at));
  },
};

/** Độ trễ so le của phần tử thứ `index` trong `count` phần tử, trải đều trên `spanMs`. */
export function stagger(index: number, count: number, spanMs: number): number {
  if (count <= 1 || spanMs <= 0) return 0;
  const i = Math.min(Math.max(index, 0), count - 1);
  return (i * spanMs) / (count - 1);
}

let motionScale = 1;

/** 1 là chuyển động đầy đủ, 0 là Giảm chuyển động. Không có mức giữa. */
export function getMotionScale(): number {
  return motionScale;
}

export function setMotionScale(value: number): void {
  motionScale = value <= 0 ? 0 : 1;
}

export function isReducedMotion(scale: number = motionScale): boolean {
  return scale <= 0;
}

/** Thời lượng chuyển động dịch vị trí: giữ nguyên, hoặc 0 khi Giảm chuyển động. */
export function scaleTiming(ms: number, scale: number = motionScale): number {
  return isReducedMotion(scale) ? 0 : ms;
}

export type MotionFamilyName = 'ui' | 'glass' | 'magic' | 'piece';

/**
 * One type per family rather than a single shape full of optional fields, so
 * `MOTION_FAMILIES.ui.tapMs` is a `number` at the call site instead of
 * `number | undefined`. A shared optional shape typechecks here but pushes a
 * non-null assertion onto every consumer.
 */
export type UiFamily = Readonly<{ ease: EaseName; tapMs: number; standardMs: number }>;
export type GlassFamily = Readonly<{ ease: EaseName; durationMs: number }>;
export type MagicFamily = Readonly<{ ease: EaseName; minMs: number; maxMs: number }>;
/** `piece` is integrated frame by frame by POSE_TAU, so it has no ease. */
export type PieceFamily = Readonly<{ ease: null; governedBy: 'POSE_TAU' }>;

export type MotionFamilies = Readonly<{
  ui: UiFamily;
  glass: GlassFamily;
  magic: MagicFamily;
  piece: PieceFamily;
}>;

export type MotionFamily = UiFamily | GlassFamily | MagicFamily | PieceFamily;

/**
 * One vocabulary for motion, so a reader can tell from the call site why a
 * value was chosen. `cubicOut` and `sineInOut` already dominate the codebase —
 * two of these four families describe what the code does rather than change it.
 */
export const MOTION_FAMILIES: MotionFamilies = {
  // Buttons, modals, toggles, navigation. Two beats: acknowledging a press
  // must feel immediate, while a transition reads better slower.
  ui: {
    ease: 'cubicOut',
    tapMs: ANIM_TOKENS.duration.buttonTapMs,
    standardMs: 200,
  },
  // Glass panels, the target medallion, the stele frame. Heavier deceleration
  // than `ui` so these read as having mass.
  glass: {
    ease: 'quartOut',
    durationMs: 300,
  },
  // Runes, constellations, shimmer, glow pulses. Slow and symmetric.
  magic: {
    ease: 'sineInOut',
    minMs: 600,
    maxMs: 1400,
  },
  // Drag, pickup, snap, settle. Governed by POSE_TAU exponential smoothing in
  // pieceMotion.ts, not by a tween — see VR0 spec §2.1 for why that model was
  // kept over the damped spring the assessment proposed.
  piece: {
    ease: null,
    governedBy: 'POSE_TAU',
  },
} as const;

/** Generic so the caller keeps the specific family type, not the union. */
export function motionFamily<K extends MotionFamilyName>(name: K): MotionFamilies[K] {
  return MOTION_FAMILIES[name];
}

