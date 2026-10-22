import { FEEDBACK_TOKENS } from '../designTokens.ts';

const D = FEEDBACK_TOKENS.holdRotate;
const SLOP = FEEDBACK_TOKENS.doubleTap.slopPx;

/** What the caller should do this frame: `start` is the first turn, `turn` each later one. */
export type HoldStep = 'none' | 'start' | 'turn';

export type HoldRotate = {
  /** The second press of a double tap landed on `pieceId`. */
  begin: (pieceId: string, x: number, y: number, nowMs: number) => void;
  /** A press that drifts past the tap slop before turning begins is a drag; later movement is ignored. */
  move: (x: number, y: number) => void;
  step: (nowMs: number) => HoldStep;
  /** Release. True when the hold had started turning, so the release is not a tap. */
  end: () => boolean;
  cancel: () => void;
};

/**
 * Turn, pause, turn, pause while the second press of a double tap stays down.
 * Pure timing: the scene owns the piece and the actual rotation.
 */
export function createHoldRotate(): HoldRotate {
  let hold: { x: number; y: number; nextAtMs: number; started: boolean } | null = null;
  return {
    begin(_pieceId, x, y, nowMs) {
      hold = { x, y, nextAtMs: nowMs + D.delayMs, started: false };
    },
    move(x, y) {
      if (!hold || hold.started) return;
      if (Math.hypot(x - hold.x, y - hold.y) > SLOP) hold = null;
    },
    step(nowMs) {
      if (!hold || nowMs < hold.nextAtMs) return 'none';
      const first = !hold.started;
      hold.started = true;
      hold.nextAtMs = nowMs + D.stepMs;
      return first ? 'start' : 'turn';
    },
    end() {
      const turning = hold?.started ?? false;
      hold = null;
      return turning;
    },
    cancel() {
      hold = null;
    },
  };
}
