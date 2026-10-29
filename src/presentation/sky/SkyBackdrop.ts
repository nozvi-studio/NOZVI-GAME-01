import Phaser from 'phaser';
import { COLOR_NUMBERS, COLOR_TOKENS, DEPTH_TOKENS, LAYOUT_TOKENS } from '../designTokens.ts';
import { generateStarField, twinkleAlpha, driftOffset, mulberry32 } from './starField.ts';
import { designViewBounds } from '../designViewport.ts';
import type { DesignView } from '../viewport.ts';
import type { Star } from './starField.ts';
import { advanceDrift } from './skyMood.ts';
import type { MoodState } from './skyMood.ts';
import { milkyWayBlobs, MILKY_WAY_SEED } from '../galaxy/milkyWay.ts';
import { deviceTilt } from './deviceTilt.ts';
import { ensureSoftDotTexture } from './parallaxStars.ts';

/**
 * Quầng sáng tròn mờ dần ra mép, dùng gradient thật của canvas 2D.
 * Chuyển từ màu đầy đủ ở tâm về trong suốt ở bán kính `radius`.
 */
export function radialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hex: string,
  peakAlpha: number
): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
  glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

export type SkyBackdropOptions = {
  seed: number;
  /** 0 đứng yên, 1 trôi đủ tốc độ; BackgroundScene tween giá trị này */
  driftSpeed: number;
};

interface EtherealRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: number;
  alpha: number;
}

/**
 * Nền trời Ethereal Observatory:
 * - Lớp trời (gradient, nebula, trăng) -> RenderTexture
 * - Lớp sao sâu Parallax (Deep Cosmos) -> TileSprite chậm
 * - Lớp sao chính tĩnh -> TileSprite
 * - Lớp sao nhấp nháy -> Image dùng chung một texture chấm sáng (đổi alpha, không vẽ lại)
 * - Lớp sóng xúc giác ánh quang (Ethereal Aura Ripples) -> Graphics
 */
export class SkyBackdrop {
  private readonly scene: Phaser.Scene;
  public readonly moodState: MoodState;
  private readonly dimLayer: Phaser.GameObjects.Rectangle;
  private readonly skyLayer: Phaser.GameObjects.RenderTexture;
  private readonly deepStarLayer: Phaser.GameObjects.TileSprite;
  private readonly starLayer: Phaser.GameObjects.TileSprite;
  private readonly twinkleSprites: Phaser.GameObjects.Image[];
  private readonly auraLayer: Phaser.GameObjects.Graphics;
  private readonly twinklingStars: Star[];
  private readonly staticStars: Star[];
  private readonly starTextureKey: string;
  private readonly deepStarTextureKey: string;
  private elapsedMs = 0;
  private driftMs = 0;
  private deepDriftMs = 0;
  private pointerParallaxX = 0;
  private pointerParallaxY = 0;
  private ripples: EtherealRipple[] = [];
  /** True while the aura layer still holds a drawing that must be cleared. */
  private auraDirty = false;

  constructor(scene: Phaser.Scene, options: SkyBackdropOptions) {
    this.scene = scene;

    const { width, height } = LAYOUT_TOKENS.canvas;
    const field = generateStarField(options.seed, { width, height });
    this.staticStars = field.static;
    this.twinklingStars = field.twinkling;
    this.starTextureKey = `sky_stars_${options.seed}`;
    this.deepStarTextureKey = `sky_deep_stars_${options.seed}`;

    const view = designViewBounds(scene);

    this.skyLayer = scene.add
      .renderTexture(view.x, view.y, view.width, view.height)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.backgroundSky);

    this.paintSky(view);
    this.buildDeepStarTexture(width, height, options.seed + 19);
    this.buildStarTexture(width, height);

    this.deepStarLayer = scene.add
      .tileSprite(view.x, view.y, view.width, view.height, this.deepStarTextureKey)
      .setOrigin(0, 0)
      .setAlpha(0.55)
      .setDepth(DEPTH_TOKENS.backgroundSky + 0.5);

    this.starLayer = scene.add
      .tileSprite(view.x, view.y, view.width, view.height, this.starTextureKey)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.backgroundSky + 1);

    // Sprites instead of a Graphics cleared and refilled every frame (30 circles re-triangulated).
    const dotKey = ensureSoftDotTexture(scene);
    this.twinkleSprites = this.twinklingStars.map((star) =>
      scene.add
        .image(star.x, star.y, dotKey)
        .setDepth(DEPTH_TOKENS.backgroundSky + 2)
        .setDisplaySize(star.r * 2.6, star.r * 2.6)
        .setTint(Phaser.Display.Color.HexStringToColor(star.color).color)
    );
    this.auraLayer = scene.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 2.5);

    this.moodState = { driftSpeed: options.driftSpeed, dim: 0 };
    this.dimLayer = scene.add
      .rectangle(view.x, view.y, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 1)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(DEPTH_TOKENS.backgroundSky + 3);
  }

  private paintSky(view: DesignView): void {
    const { width, height } = LAYOUT_TOKENS.canvas;
    const viewHeight = Math.ceil(view.height);
    const key = `sky_milky_${width}x${viewHeight}`;
    const tm = this.scene.textures;
    const frameTop = (view.height - height) / 2;

    if (!tm.exists(key)) {
      const canvas = tm.createCanvas(key, width, viewHeight);
      if (canvas) {
        const ctx = canvas.context;

        const sky = ctx.createLinearGradient(0, frameTop, 0, frameTop + height);
        COLOR_TOKENS.sky.stops.forEach((stop, i) => {
          sky.addColorStop(COLOR_TOKENS.sky.stopOffsets[i], stop);
        });
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, viewHeight);

        for (const blob of milkyWayBlobs(MILKY_WAY_SEED, width, height)) {
          radialGlow(ctx, blob.x, frameTop + blob.y, blob.r, blob.hex, blob.alpha);
        }

        radialGlow(ctx, 108, frameTop + 436, 396, COLOR_TOKENS.sky.nebulaBlue, 0.45);
        radialGlow(ctx, 648, frameTop + 966, 360, COLOR_TOKENS.sky.nebulaPink, 0.32);
        radialGlow(ctx, 619, frameTop + 140, 158, COLOR_TOKENS.sky.moonHalo, 0.35);
        radialGlow(ctx, 619, frameTop + 140, 62, COLOR_TOKENS.sky.moonCore, 0.9);

        canvas.refresh();
      }
    }

    this.skyLayer.draw(key, 0, 0);
  }

  private buildDeepStarTexture(width: number, height: number, seed: number): void {
    if (this.scene.textures.exists(this.deepStarTextureKey)) return;
    const random = mulberry32(seed);
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 0; i < 140; i++) {
      const x = random() * width;
      const y = random() * height;
      const r = 0.7 + random() * 0.7;
      const alpha = 0.4 + random() * 0.45;
      const tintChoice = random();
      const color = tintChoice > 0.65 ? COLOR_NUMBERS.amberSolid : tintChoice > 0.3 ? 0x7fb8ff : 0xcfe6ff;
      g.fillStyle(color, alpha);
      g.fillCircle(x, y, r);
    }
    g.generateTexture(this.deepStarTextureKey, width, height);
    g.destroy();
  }

  private buildStarTexture(width: number, height: number): void {
    if (this.scene.textures.exists(this.starTextureKey)) return;

    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (const star of this.staticStars) {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(star.color).color, star.alpha);
      g.fillCircle(star.x, star.y, star.r);
    }
    g.generateTexture(this.starTextureKey, width, height);
    g.destroy();
  }

  /**
   * Tạo một gợn sóng ánh quang êm dịu (Ethereal Ripple) tại vị trí người chơi chạm vào
   */
  public spawnRipple(x: number, y: number, color: number = COLOR_NUMBERS.gridFine, maxRadius = 110): void {
    if (this.ripples.length > 8) {
      this.ripples.shift();
    }
    this.ripples.push({
      x,
      y,
      r: 6,
      maxR: maxRadius,
      color,
      alpha: 0.5,
    });
  }

  public setPointerOffset(screenX: number, screenY: number): void {
    const { width, height } = LAYOUT_TOKENS.canvas;
    const nx = Phaser.Math.Clamp((screenX - width / 2) / (width / 2), -1, 1);
    const ny = Phaser.Math.Clamp((screenY - height / 2) / (height / 2), -1, 1);
    this.pointerParallaxX = nx * 10;
    this.pointerParallaxY = ny * 10;
    deviceTilt.setPointer(nx, ny);
  }

  public update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.driftMs = advanceDrift(this.driftMs, deltaMs, this.moodState.driftSpeed);
    this.deepDriftMs = advanceDrift(this.deepDriftMs, deltaMs, this.moodState.driftSpeed * 0.42);

    const { height } = LAYOUT_TOKENS.canvas;
    const offset = driftOffset(this.driftMs, height);
    const deepOffset = driftOffset(this.deepDriftMs, height);
    deviceTilt.update(deltaMs);
    const tilt = deviceTilt.getTilt();
    const totalParallaxX = this.pointerParallaxX + tilt.x * 24;
    const totalParallaxY = this.pointerParallaxY + tilt.y * 24;

    this.deepStarLayer.tilePositionY = -deepOffset + totalParallaxY * 1.35;
    this.deepStarLayer.tilePositionX = totalParallaxX * 1.35;

    this.starLayer.tilePositionY = -offset + totalParallaxY * 0.75;
    this.starLayer.tilePositionX = totalParallaxX * 0.75;

    for (let i = 0; i < this.twinklingStars.length; i++) {
      const star = this.twinklingStars[i];
      this.twinkleSprites[i]
        .setPosition(
          star.x + totalParallaxX * 0.75,
          (star.y + offset + totalParallaxY * 0.75) % height
        )
        .setAlpha(twinkleAlpha(star, this.elapsedMs));
    }

    // Vẽ và cập nhật các gợn sóng xúc giác thiền định (Aura Ripples)
    if (this.ripples.length > 0 || this.auraDirty) {
      this.drawRipples(deltaMs);
    }

    this.dimLayer.setAlpha(this.moodState.dim);
  }

  private drawRipples(deltaMs: number): void {
    this.auraLayer.clear();
    this.auraDirty = this.ripples.length > 0;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.r += (rip.maxR - rip.r) * Math.min(1, deltaMs * 0.0035);
      rip.alpha -= deltaMs * 0.00065;

      if (rip.alpha <= 0.01) {
        this.ripples.splice(i, 1);
        continue;
      }

      // Vòng hào quang mềm mờ
      this.auraLayer.lineStyle(1.8, rip.color, rip.alpha);
      this.auraLayer.strokeCircle(rip.x, rip.y, rip.r);
      this.auraLayer.fillStyle(rip.color, rip.alpha * 0.15);
      this.auraLayer.fillCircle(rip.x, rip.y, rip.r * 0.65);
    }
    this.auraDirty = this.ripples.length > 0;
  }

  public destroy(): void {
    this.dimLayer.destroy();
    this.skyLayer.destroy();
    this.deepStarLayer.destroy();
    this.starLayer.destroy();
    this.twinkleSprites.forEach((sprite) => sprite.destroy());
    this.auraLayer.destroy();
    if (this.scene.textures.exists(this.starTextureKey)) {
      this.scene.textures.remove(this.starTextureKey);
    }
    if (this.scene.textures.exists(this.deepStarTextureKey)) {
      this.scene.textures.remove(this.deepStarTextureKey);
    }
  }
}
