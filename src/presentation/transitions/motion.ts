import { ANIM_TOKENS, FEEDBACK_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';
import { EASES as CORE_EASES } from '../../engine/core/transitions/motion.ts';
import type { EaseName as CoreEaseName } from '../../engine/core/transitions/motion.ts';

export {
  getMotionScale,
  isReducedMotion,
  scaleTiming,
  setMotionScale,
  stagger,
} from '../../engine/core/transitions/motion.ts';

export type RouteId = keyof typeof TRANSITION_TOKENS.routes;

/** The core ease names plus the one that reads a game token. */
export type EaseName = CoreEaseName | 'anticipateOut';

/** Hàm easing thuần, t trong [0, 1]. Tự viết để test được mà không cần Phaser. */
export const EASES: Record<EaseName, (t: number) => number> = {
  ...CORE_EASES,
  anticipateOut: (t) => {
    const { pickupDipLift: dip, pickupDipAt: at } = FEEDBACK_TOKENS;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    if (t <= at) return dip * EASES.cubicOut(t / at);
    return dip + (1 - dip) * EASES.cubicOut((t - at) / (1 - at));
  },
};

export type MotionFamilyName = 'ui' | 'glass' | 'magic' | 'piece';

/**
 * One type per family rather than a single shape full of optional fields, so
 * `MOTION_FAMILIES.ui.tapMs` is a `number` at the call site instead of
 * `number | undefined`. A shared optional shape typechecks here but pushes a
 * non-null assertion onto every consumer.
 */
export type UiFamily = Readonly<{ ease: CoreEaseName; tapMs: number; standardMs: number }>;
export type GlassFamily = Readonly<{ ease: CoreEaseName; durationMs: number }>;
export type MagicFamily = Readonly<{ ease: CoreEaseName; minMs: number; maxMs: number }>;
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
