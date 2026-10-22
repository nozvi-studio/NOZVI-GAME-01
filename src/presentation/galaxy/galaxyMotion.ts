/** Pure pose functions for galaxy-artwork motion that SVG keyframes expressed in the kit mockup. */
const TAU = Math.PI * 2;
export const ORBIT_PERIOD_MS = 6000;
export const METEOR_PERIOD_MS = 8000;
/** Meteor flight vector in kit units (350-unit artboard). */
export const METEOR_TRAVEL = { x: 240, y: 160 } as const;

const mod = (value: number, period: number): number => ((value % period) + period) % period;

export type OrbitSpec = {
  rx: number;
  ry: number;
  /** Streak length as a fraction of the ring (kit: 7% white, 3% blue). */
  fraction: number;
  phaseMs: number;
  dots: number;
};

/** One dot of a streak running clockwise around the ring; index 0 is the bright head. Kit units, ring-centred. */
export function orbitDotPose(elapsedMs: number, spec: OrbitSpec, index: number): { x: number; y: number; alpha: number } {
  const head = TAU * (mod(elapsedMs + spec.phaseMs, ORBIT_PERIOD_MS) / ORBIT_PERIOD_MS);
  const angle = head - TAU * spec.fraction * (index / Math.max(1, spec.dots - 1));
  return { x: spec.rx * Math.cos(angle), y: spec.ry * Math.sin(angle), alpha: 1 - (index / spec.dots) * 0.9 };
}

/** Kit `meteor` keyframes: invisible → visible at 3% → gone at 13% of an 8 s cycle, easing in along the flight. */
export function meteorPose(elapsedMs: number, delayMs: number): { dx: number; dy: number; alpha: number } {
  if (elapsedMs < delayMs) return { dx: 0, dy: 0, alpha: 0 };
  const p = mod(elapsedMs - delayMs, METEOR_PERIOD_MS) / METEOR_PERIOD_MS;
  if (p >= 0.13) return { dx: 0, dy: 0, alpha: 0 };
  const travel = (p / 0.13) ** 2;
  const alpha = p < 0.03 ? p / 0.03 : 1 - (p - 0.03) / 0.1;
  return { dx: METEOR_TRAVEL.x * travel, dy: METEOR_TRAVEL.y * travel, alpha };
}
