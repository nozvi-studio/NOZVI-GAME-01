import { FEEDBACK_TOKENS } from '../designTokens.ts';

const N = FEEDBACK_TOKENS.idleNudge;

/**
 * Idle clock. `phase` is progress through the current beat in [0, 1); it is only
 * meaningful while `active`. `beat` counts beats since the wait ended, so the
 * caller can give each beat to the next piece. Pure data, testable without Phaser.
 */
export type IdleNudgeState = { idleMs: number; active: boolean; phase: number; beat: number };

export const IDLE_NUDGE_START: IdleNudgeState = { idleMs: 0, active: false, phase: 0, beat: 0 };

export type IdleNudgeInput = {
  /** Any touch, drag, rotate or button press this frame */
  activity: boolean;
  /** Dragging, won, or reduced motion: the nudge must not run and the clock restarts */
  blocked: boolean;
};

export function stepIdleNudge(state: IdleNudgeState, dtMs: number, input: IdleNudgeInput): IdleNudgeState {
  if (input.activity || input.blocked) return IDLE_NUDGE_START;
  const idleMs = state.idleMs + dtMs;
  const t = idleMs - N.waitMs;
  if (t < 0) return { idleMs, active: false, phase: 0, beat: 0 };
  const cycleMs = N.beatMs + N.restMs;
  const beat = Math.floor(t / cycleMs);
  const inCycle = t % cycleMs;
  if (inCycle >= N.beatMs) return { idleMs, active: false, phase: 0, beat };
  return { idleMs, active: true, phase: inCycle / N.beatMs, beat };
}

/** 0 at both ends of a beat so it eases in and out instead of snapping */
function envelope(phase: number): number {
  return Math.sin(Math.PI * phase);
}

export type NudgeOffset = { x: number; y: number; angleDeg: number };

/** Sway of the piece whose turn it is; `null` (no beat running) is no offset. */
export function nudgeOffset(phase: number | null): NudgeOffset {
  if (phase === null) return { x: 0, y: 0, angleDeg: 0 };
  const e = envelope(phase);
  const wave = Math.sin(2 * Math.PI * N.swaysPerBeat * phase);
  const lift = Math.cos(2 * Math.PI * N.swaysPerBeat * phase);
  return { x: N.px * wave * e, y: N.px * 0.5 * lift * e, angleDeg: N.angleDeg * wave * e };
}

/** Multiplier on the target outline alpha: 1 at rest, breathing within ±breathAmp. */
export function nudgeAlpha(phase: number | null): number {
  if (phase === null) return 1;
  return 1 + N.breathAmp * Math.sin(2 * Math.PI * N.breathsPerBeat * phase) * envelope(phase);
}
