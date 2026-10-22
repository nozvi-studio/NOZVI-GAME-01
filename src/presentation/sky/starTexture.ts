import Phaser from 'phaser';
import { starPolygon } from '../hud/timeBarModel.ts';

/**
 * Star art from the mockups (PlayTimer, VictoryStars): a lit star has a vertical gold gradient,
 * a dark rim and a small white highlight star up and to the left; an empty slot is a dark star
 * with a faint lilac rim. Drawn once per size into a canvas texture, because Phaser Graphics
 * cannot fill a polygon with a gradient.
 */
export type StarLook = 'lit' | 'slot';

const LIT_STOPS: Array<[number, string]> = [
  [0, '#FFF3B0'],
  [0.55, '#FFC857'],
  [1, '#F59E0B'],
];

/** Rim width relative to the outer radius (mockup: 3.2 px on a 27 px star). */
const RIM = 0.12;

function tracePolygon(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Texture key for a star of `outer` radius; the texture is square with room for the rim. */
export function starTexture(scene: Phaser.Scene, look: StarLook, outer: number): string {
  const r = Math.round(outer);
  const key = `star_${look}_${r}`;
  const tm = scene.textures;
  if (tm.exists(key)) return key;

  const rim = Math.max(1.5, r * RIM);
  const size = Math.ceil(r * 2 + rim * 2 + 2);
  const canvas = tm.createCanvas(key, size, size);
  if (!canvas) return key;
  const ctx = canvas.context;
  const c = size / 2;
  // The star spans cy - r to cy + 0.81 r; shift it so that span is centred in the texture.
  const cy = c + r * 0.095;
  const pts = starPolygon(c, cy, r);

  ctx.lineJoin = 'round';
  ctx.lineWidth = rim;
  tracePolygon(ctx, pts);
  if (look === 'lit') {
    const fill = ctx.createLinearGradient(0, cy - r, 0, cy + r * 0.81);
    for (const [at, color] of LIT_STOPS) fill.addColorStop(at, color);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#120E36';
    ctx.stroke();
    tracePolygon(ctx, starPolygon(c - r * 0.12, cy - r * 0.18, r * 0.42));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(28, 26, 74, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140, 147, 201, 0.6)';
    ctx.stroke();
  }
  canvas.refresh();
  return key;
}
