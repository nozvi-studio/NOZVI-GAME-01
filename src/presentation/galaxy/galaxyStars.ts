import { mulberry32 } from '../sky/starField.ts';

export type GalaxyStar = { x: number; y: number; speed: number; phase: number; radius: number };

export function createGalaxyStars(seed: number): GalaxyStar[] {
  const random = mulberry32(seed);
  return Array.from({ length: 30 }, () => ({
    x: random(), y: random(), speed: 0.008 + random() * 0.012,
    phase: random() * Math.PI * 2, radius: 1.5 + random() * 1.2,
  }));
}

/** Fade before wrapping so no star appears abruptly at a texture boundary. */
export function galaxyStarPose(star: GalaxyStar, elapsedMs: number, size: number) {
  const travel = elapsedMs / 1000 * star.speed;
  const x = ((star.x + travel * 0.35) % 1) - 0.5;
  const y = ((star.y + travel) % 1) - 0.5;
  const fade = Math.max(0, Math.min(1, (0.48 - Math.hypot(x, y)) / 0.16));
  const twinkle = 0.70 + 0.30 * Math.sin(elapsedMs / 850 + star.phase);
  return { x: x * size, y: y * size, alpha: fade * twinkle };
}
