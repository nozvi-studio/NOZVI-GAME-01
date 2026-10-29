import { FEEDBACK_TOKENS } from '../designTokens.ts';

const D = FEEDBACK_TOKENS.doubleTap;

type Point = { x: number; y: number };

export type DoubleTap = {
  /**
   * Report a finished press. Returns true when it completes a double tap: a quick
   * second tap on the same piece. A press that travelled farther than `slopPx`
   * was a drag, not a tap, and clears the pending tap.
   */
  register: (pieceId: string | null, down: Point, up: Point, nowMs: number) => boolean;
  /** Whether `register` with the same arguments would complete a double tap. Does not consume anything. */
  wouldComplete: (pieceId: string | null, down: Point, up: Point, nowMs: number) => boolean;
  /** True when a first tap on `pieceId` is still waiting for its second one. Does not consume it. */
  pending: (pieceId: string, nowMs: number) => boolean;
  reset: () => void;
};

export function createDoubleTap(): DoubleTap {
  let last: { pieceId: string; atMs: number } | null = null;
  return {
    register(pieceId, down, up, nowMs) {
      const isTap = pieceId !== null && Math.hypot(up.x - down.x, up.y - down.y) <= D.slopPx;
      if (!isTap) {
        last = null;
        return false;
      }
      if (last && last.pieceId === pieceId && nowMs - last.atMs <= D.windowMs) {
        last = null;
        return true;
      }
      last = { pieceId, atMs: nowMs };
      return false;
    },
    wouldComplete(pieceId, down, up, nowMs) {
      const isTap = pieceId !== null && Math.hypot(up.x - down.x, up.y - down.y) <= D.slopPx;
      return isTap && last !== null && last.pieceId === pieceId && nowMs - last.atMs <= D.windowMs;
    },
    pending(pieceId, nowMs) {
      return last !== null && last.pieceId === pieceId && nowMs - last.atMs <= D.windowMs;
    },
    reset() {
      last = null;
    },
  };
}
