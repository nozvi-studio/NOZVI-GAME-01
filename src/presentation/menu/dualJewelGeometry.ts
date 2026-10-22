import { jewelOutline } from '../board/jewelGeometry.ts';
import { clipConvex, type Pt } from '../board/polygonClip.ts';

/** Full loop length. The reviewer chose the full XOR reveal over a hint. */
export const EMBLEM_LOOP_MS = 6000;

/** Half-distance between the two jewel centres, in pixels. */
/**
 * Must exceed the jewel radius, or the two jewels already overlap at "rest"
 * and the drift-together beat never reads. At 78 with radius 68 they sit 20px
 * apart, and the pair still fits inside the 150px orbit ring.
 */
export const REST_OFFSET = 78;
export const OVERLAP_OFFSET = 20;

/** Pose held when Reduced Motion is on: overlapped, star lit. */
export const FROZEN_POSE_MS = 3400;

const APPROACH_START_MS = 800;
const APPROACH_END_MS = 3000;
const HOLD_END_MS = 4000;
const RETREAT_END_MS = 5400;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Half-separation of the jewel centres at a point in the loop. */
export function emblemOffsetAt(tMs: number): number {
  const t = ((tMs % EMBLEM_LOOP_MS) + EMBLEM_LOOP_MS) % EMBLEM_LOOP_MS;
  if (t <= APPROACH_START_MS) return REST_OFFSET;
  if (t <= APPROACH_END_MS) {
    const p = (t - APPROACH_START_MS) / (APPROACH_END_MS - APPROACH_START_MS);
    return lerp(REST_OFFSET, OVERLAP_OFFSET, easeInOut(p));
  }
  if (t <= HOLD_END_MS) return OVERLAP_OFFSET;
  if (t <= RETREAT_END_MS) {
    const p = (t - HOLD_END_MS) / (RETREAT_END_MS - HOLD_END_MS);
    return lerp(OVERLAP_OFFSET, REST_OFFSET, easeInOut(p));
  }
  return REST_OFFSET;
}

/**
 * Intersection of the two jewels. Empty when they do not meet, so the caller
 * can simply skip drawing rather than special-casing the rest pose.
 */
export function emblemOverlap(offset: number, radius: number): Pt[] {
  if (offset >= radius) return [];
  const left = jewelOutline(-offset, 0, radius);
  const right = jewelOutline(offset, 0, radius);
  return clipConvex(left, right);
}

/** Star fades in once the overlap exists, and out again as the jewels part. */
export function emblemStarAlpha(tMs: number): number {
  const t = ((tMs % EMBLEM_LOOP_MS) + EMBLEM_LOOP_MS) % EMBLEM_LOOP_MS;
  if (t <= APPROACH_END_MS) return 0;
  if (t <= FROZEN_POSE_MS) {
    return (t - APPROACH_END_MS) / (FROZEN_POSE_MS - APPROACH_END_MS);
  }
  if (t <= HOLD_END_MS) return 1;
  if (t <= RETREAT_END_MS) {
    return 1 - (t - HOLD_END_MS) / (RETREAT_END_MS - HOLD_END_MS);
  }
  return 0;
}

/**
 * Advance the loop, or hold the taught pose when Reduced Motion is on. Kept
 * here rather than inside the renderer so the behaviour is covered by a test
 * instead of only by eye.
 */
export function nextElapsed(currentMs: number, deltaMs: number, reduced: boolean): number {
  return reduced ? FROZEN_POSE_MS : currentMs + deltaMs;
}
