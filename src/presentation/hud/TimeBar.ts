import Phaser from 'phaser';
import type { PlayViewSnapshot } from '../../application/playController.ts';
import { DEPTH_TOKENS } from '../designTokens.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { starTexture } from '../sky/starTexture.ts';
import { TIME_BAR, timeBarModel } from './timeBarModel.ts';

const ICE = 0x5ad1e0;
/**
 * White gloss over the top of the fill (mockup: white .45 fading out at 60 % of the height),
 * as stacked strips from the top edge: [height as a fraction of the fill, alpha].
 */
const GLOSS_BANDS: ReadonlyArray<readonly [number, number]> = [
  [0.6, 0.12],
  [0.4, 0.14],
  [0.2, 0.16],
];

/** Draining time bar with three stars on top (mockup PlayTimer). Shown only for campaign levels. */
export class TimeBar {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Graphics;
  private readonly slots: Phaser.GameObjects.Image[] = [];
  private readonly lit: Phaser.GameObjects.Container[] = [];
  private readonly fallen = [false, false, false];
  private readonly left: number;

  constructor(scene: Phaser.Scene, layout: LayoutMetrics) {
    this.scene = scene;
    const { width, height } = TIME_BAR;
    this.left = -width / 2;
    // Centre of the bar; PlayScene moves the subtitle above it to TIME_BAR.subtitleY.
    this.root = scene.add.container(360, layout.headerBounds.y + TIME_BAR.centerY).setDepth(DEPTH_TOKENS.hudControls);

    const track = scene.add.graphics();
    // Soft ice glow around the track (mockup box-shadow 0 0 12px #5AD1E066).
    for (const [grow, alpha] of [[10, 0.08], [6, 0.14]] as const) {
      track.lineStyle(grow, ICE, alpha);
      track.strokeRoundedRect(this.left, -height / 2, width, height, height / 2);
    }
    track.fillStyle(0x05051e, 0.65);
    track.fillRoundedRect(this.left, -height / 2, width, height, height / 2);
    track.lineStyle(3, ICE, 1);
    track.strokeRoundedRect(this.left, -height / 2, width, height, height / 2);
    this.fill = scene.add.graphics();
    this.root.add([track, this.fill]);

    const outer = TIME_BAR.starSize * 0.42;
    for (let i = 0; i < 3; i++) {
      const x = this.left + width * TIME_BAR.starFractions[i];
      const slot = scene.add.image(x, 0, starTexture(scene, 'slot', outer));
      const lit = scene.add.container(x, 0, [scene.add.image(0, 0, starTexture(scene, 'lit', outer))]);
      this.slots.push(slot);
      this.lit.push(lit);
      this.root.add([slot, lit]);
    }
  }

  /** Design-space bounds of the bar and its stars (for the tutorial spotlight); null when it is hidden. */
  bounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.root.visible) return null;
    const height = Math.max(TIME_BAR.height, TIME_BAR.starSize);
    return { x: this.root.x - TIME_BAR.width / 2, y: this.root.y - height / 2, width: TIME_BAR.width, height };
  }

  update(timer: PlayViewSnapshot['timer']): void {
    this.root.setVisible(timer !== null);
    if (!timer) return;
    const model = timeBarModel(timer.elapsedMs, timer.budgetMs);
    const { width, height } = TIME_BAR;
    const inner = height - 6;
    this.fill.clear();
    if (model.fill > 0) {
      const fillW = Math.max(inner, (width - 6) * model.fill);
      this.fill.fillStyle(model.color, 1);
      this.fill.fillRoundedRect(this.left + 3, -inner / 2, fillW, inner, inner / 2);
      // Strips are inset from the rounded ends so they never poke outside the pill.
      const inset = inner * 0.3;
      if (fillW > inset * 2) {
        for (const [frac, alpha] of GLOSS_BANDS) {
          const h = inner * frac;
          this.fill.fillStyle(0xffffff, alpha);
          this.fill.fillRoundedRect(this.left + 3 + inset, -inner / 2 + 1, fillW - inset * 2, h, Math.min(h / 2, inset));
        }
      }
    }
    model.starsLeft.forEach((alive, i) => {
      if (!alive && !this.fallen[i]) this.dropStar(i);
      if (alive && this.fallen[i]) this.restoreStar(i);
    });
  }

  private dropStar(i: number): void {
    this.fallen[i] = true;
    const star = this.lit[i];
    this.scene.tweens.killTweensOf(star);
    if (isReducedMotion()) {
      star.setVisible(false);
      return;
    }
    const { dropPx, turn, scale, pop } = TIME_BAR.fall;
    this.scene.tweens.add({
      targets: star,
      scale: pop,
      duration: 90,
      ease: 'Cubic.easeOut',
      onComplete: () =>
        this.scene.tweens.add({
          targets: star,
          y: dropPx,
          angle: turn,
          scale,
          alpha: 0,
          duration: 380,
          ease: 'Cubic.easeIn',
        }),
    });
  }

  /** Level reset: bring the stars back. */
  private restoreStar(i: number): void {
    this.fallen[i] = false;
    const star = this.lit[i];
    this.scene.tweens.killTweensOf(star);
    star.setVisible(true).setScale(1).setAngle(0).setAlpha(1).setY(0);
  }

  destroy(): void {
    this.root.destroy();
  }
}
