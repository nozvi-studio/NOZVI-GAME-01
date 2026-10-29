import Phaser from 'phaser';
import { mulberry32 } from './starField.ts';

export type ParallaxStarSpec = {
  count: number;
  seed: number;
  colors: readonly number[];
  minRadius: number;
  maxRadius: number;
  minAlpha: number;
  maxAlpha: number;
  /** Faint halo drawn at 2.2x the radius (mid layer). */
  halo?: boolean;
  /** Chance of a white core on top of the star colour. */
  coreChance: number;
};

function css(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;
}

/**
 * Bakes a star field into a canvas texture once. A Phaser Graphics holding hundreds of
 * fillCircle calls is re-triangulated (earcut) every frame; an Image or TileSprite of this
 * texture costs one quad, so parallax only moves a sprite.
 */
export function ensureParallaxStarTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  spec: ParallaxStarSpec
): string {
  const tm = scene.textures;
  if (tm.exists(key)) return key;
  const canvas = tm.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!canvas) return key;
  const ctx = canvas.context;
  const random = mulberry32(spec.seed);
  for (let i = 0; i < spec.count; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = spec.minRadius + random() * (spec.maxRadius - spec.minRadius);
    const color = spec.colors[Math.floor(random() * spec.colors.length)];
    const alpha = spec.minAlpha + random() * (spec.maxAlpha - spec.minAlpha);
    if (spec.halo) {
      ctx.fillStyle = css(color, alpha * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css(color, alpha);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (random() < spec.coreChance) {
      ctx.fillStyle = css(0xffffff, Math.min(1, alpha + 0.3));
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  canvas.refresh();
  return key;
}

const SOFT_DOT_KEY = 'sky_soft_dot';
const SOFT_DOT_SIZE = 16;

/** White dot with a bright core, tinted per sprite; shared by twinkling stars and motes. */
export function ensureSoftDotTexture(scene: Phaser.Scene): string {
  const tm = scene.textures;
  if (tm.exists(SOFT_DOT_KEY)) return SOFT_DOT_KEY;
  const canvas = tm.createCanvas(SOFT_DOT_KEY, SOFT_DOT_SIZE, SOFT_DOT_SIZE);
  if (!canvas) return SOFT_DOT_KEY;
  const ctx = canvas.context;
  const c = SOFT_DOT_SIZE / 2;
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SOFT_DOT_SIZE, SOFT_DOT_SIZE);
  canvas.refresh();
  return SOFT_DOT_KEY;
}
