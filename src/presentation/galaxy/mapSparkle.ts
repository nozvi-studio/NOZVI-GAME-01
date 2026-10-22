import { mulberry32 } from '../sky/starField.ts';

export type Sparkle = { x: number; y: number; size: number; phase: number; periodMs: number };
export type MeteorPose = { progress: number; alpha: number; rx: number; ry: number };

const MAP_WIDTH = 720;
const METEOR_SLOT_MS = 9000;
const METEOR_MS = 900;

/** Fixed scatter of twinkling stars over a vertical stretch of the map. */
export function createSparkles(seed: number, count: number, top: number, bottom: number, maxSize: number): Sparkle[] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random() * MAP_WIDTH,
    y: top + random() * (bottom - top),
    size: maxSize * (0.5 + random() * 0.5),
    phase: random() * Math.PI * 2,
    periodMs: 2200 + random() * 3000,
  }));
}

/** Slow sine twinkle that never drops to invisible. */
export function sparkleAlpha(sparkle: Sparkle, elapsedMs: number): number {
  return 0.15 + 0.85 * (0.5 + 0.5 * Math.sin((elapsedMs / sparkle.periodMs) * Math.PI * 2 + sparkle.phase));
}

/**
 * One shooting star per 9s slot, at a seeded moment. rx/ry are 0..1 offsets the
 * scene maps into whatever part of the map the player is looking at.
 */
export function meteorPose(elapsedMs: number): MeteorPose | null {
  const slot = Math.floor(elapsedMs / METEOR_SLOT_MS);
  const random = mulberry32(slot * 977 + 13);
  const start = 1500 + random() * 5000;
  const rx = random();
  const ry = random();
  const local = (elapsedMs % METEOR_SLOT_MS) - start;
  if (local < 0 || local >= METEOR_MS) return null;
  const progress = local / METEOR_MS;
  return { progress, alpha: Math.sin(progress * Math.PI), rx, ry };
}
