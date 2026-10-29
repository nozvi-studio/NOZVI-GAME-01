import type Phaser from 'phaser';
import { deviceTilt } from '../sky/deviceTilt.ts';
import type { CanvasPoint } from './layout.ts';

/** Positions of the streak baked into one strip; the tilt picks the nearest. */
export const SHEEN_FRAMES = 7;
/** The streak is soft, so its strip is baked at this share of the silhouette size. */
export const SHEEN_SCALE = 0.5;
/** Streak travel, in piece-square widths: starts and ends just outside the piece. */
const TRAVEL_FROM = -0.2;
const TRAVEL_TO = 1.2;
const BASE_ALPHA = 0.08;
const TILT_ALPHA = 0.22;

export function sheenFrameName(index: number): string {
  return `sheen${index}`;
}

/**
 * Bakes the streak at SHEEN_FRAMES positions, each clipped to the piece outline, into one canvas
 * texture (a strip of frames). Sliding the light is then a frame switch, with no mask or shader.
 * Returns the bytes used, or null when the scene cannot make canvas textures.
 */
export function bakePieceSheen(
  scene: Phaser.Scene,
  key: string,
  outline: readonly CanvasPoint[],
  size: number
): number | null {
  const tm = scene.textures;
  if (typeof tm.createCanvas !== 'function') return null;
  const canvas = tm.createCanvas(key, size * SHEEN_FRAMES, size);
  if (!canvas) return null;
  const ctx = canvas.context;
  const skew = -0.35;
  const half = size * 0.15;
  for (let i = 0; i < SHEEN_FRAMES; i++) {
    const centre = size * (TRAVEL_FROM + ((TRAVEL_TO - TRAVEL_FROM) * i) / (SHEEN_FRAMES - 1));
    ctx.save();
    ctx.translate(i * size, 0);
    ctx.beginPath();
    outline.forEach((p, n) => (n === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
    // Lean the streak like a reflection, sheared around the middle row.
    ctx.transform(1, 0, skew, 1, -skew * (size / 2), 0);
    const gradient = ctx.createLinearGradient(centre - half, 0, centre + half, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(240,247,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(centre - half, 0, half * 2, size);
    ctx.restore();
  }
  canvas.refresh();
  for (let i = 0; i < SHEEN_FRAMES; i++) canvas.add(sheenFrameName(i), 0, i * size, 0, size, size);
  return size * size * SHEEN_FRAMES * 4;
}

/** Which baked frame and how bright, from the device tilt (mouse on desktop). */
export function sheenLook(reduced: boolean): { frame: number; alpha: number } {
  const tilt = reduced ? { x: 0, y: 0 } : deviceTilt.getTilt();
  const lean = Math.max(-1, Math.min(1, tilt.x * 0.8 + tilt.y * 0.4));
  return {
    frame: Math.round(((lean + 1) / 2) * (SHEEN_FRAMES - 1)),
    alpha: BASE_ALPHA + TILT_ALPHA * Math.abs(lean),
  };
}
