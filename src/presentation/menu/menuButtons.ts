import Phaser from 'phaser';

/**
 * Menu chrome from the Menu1/Menu2 mockups (390 px wide), ported to the 720 px
 * canvas, shrunk a little from the strict 720/390 so the menu is not crowded.
 * Every mockup length is multiplied by K.
 */
export const MENU_K = 1.6;

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The hero "Tiếp tục" button: amber gradient face, hard 5 px lower edge and a
 * soft amber glow (CSS: `0 5px 0 #B87514, 0 0 24px rgba(255,200,87,.55)`).
 * Returns the image, positioned so the face is centred on the origin.
 */
export function createPrimaryButtonImage(
  scene: Phaser.Scene,
  width: number,
  height: number
): Phaser.GameObjects.Image {
  const radius = 20 * MENU_K;
  const edge = 5 * MENU_K;
  const glow = 24 * MENU_K;
  const pad = Math.ceil(glow * 2);
  const w = Math.ceil(width + pad * 2);
  const h = Math.ceil(height + edge + pad * 2);
  const key = `menu-primary-btn-${width}x${height}`;

  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, w, h);
    if (texture) {
      const ctx = texture.getContext();
      ctx.save();
      ctx.shadowColor = 'rgba(255,200,87,.55)';
      ctx.shadowBlur = glow;
      ctx.fillStyle = '#FFC857';
      roundedRectPath(ctx, pad, pad, width, height, radius);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#B87514';
      roundedRectPath(ctx, pad, pad + edge, width, height, radius);
      ctx.fill();

      const face = ctx.createLinearGradient(0, pad, 0, pad + height);
      face.addColorStop(0, '#FFE29A');
      face.addColorStop(0.55, '#FFC857');
      face.addColorStop(1, '#F0A83A');
      ctx.fillStyle = face;
      roundedRectPath(ctx, pad, pad, width, height, radius);
      ctx.fill();
      texture.refresh();
    }
  }
  return scene.add.image(0, 0, key).setOrigin(0.5, (pad + height / 2) / h);
}

/** Dark glass pill with an accent rim, as used by the language switch, badge and secondary button. */
export function drawGlassPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  rim: number,
  rimWidth: number,
  fillAlpha = 0.55
): void {
  g.fillStyle(0x0a0a28, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (rimWidth > 0) {
    g.lineStyle(rimWidth, rim, 1);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

/** The mockup's gear: a 3.2 radius ring with eight short rays on a 24 unit grid. */
export function drawGear(g: Phaser.GameObjects.Graphics, size: number): void {
  const u = size / 24;
  g.lineStyle(2 * u, 0xffffff, 1);
  g.strokeCircle(0, 0, 3.2 * u);
  const rays: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, -9.5, 0, -6.5], [0, 9.5, 0, 6.5], [-9.5, 0, -6.5, 0], [9.5, 0, 6.5, 0],
    [-6.7, -6.7, -4.6, -4.6], [4.6, 4.6, 6.6, 6.6], [-6.7, 6.7, -4.6, 4.6], [4.6, -4.6, 6.6, -6.6],
  ];
  for (const [x1, y1, x2, y2] of rays) g.lineBetween(x1 * u, y1 * u, x2 * u, y2 * u);
}
