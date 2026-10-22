import Phaser from 'phaser';
import { GESTURE_LOOP_MS, gesturePose } from './tutorialGeometry.ts';
import type { GestureKind } from './tutorialGeometry.ts';
import { isReducedMotion } from '../transitions/motion.ts';

/** The icon plate, in `unit` pixels. */
export const GESTURE_ICON_WIDTH = 64;
export const GESTURE_ICON_HEIGHT = 44;

/** A representative still frame for reduced motion: finger down (double tap), mid-hold with turns (hold). */
const STILL_MS: Record<GestureKind, number> = { 'double-tap': 250, 'double-tap-hold': 1500 };

/**
 * A small looping picture of a gesture: a mini roof piece on the left that turns a quarter per step,
 * a fingertip on the right that presses, ripples on each tap, and an arc while a turn happens.
 * `x, y` is its top-left corner; `unit` is the pixel size of one design unit (k).
 */
export class TutorialGestureIcon {
  readonly graphics: Phaser.GameObjects.Graphics;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly kind: GestureKind,
    x: number,
    y: number,
    private readonly unit: number,
    depth: number
  ) {
    this.graphics = scene.add.graphics().setDepth(depth).setPosition(x, y);
    if (isReducedMotion()) {
      this.draw(STILL_MS[kind]);
      return;
    }
    const loop = GESTURE_LOOP_MS[kind];
    this.tween = scene.tweens.addCounter({
      from: 0,
      to: loop,
      duration: loop,
      repeat: -1,
      onUpdate: (tween) => this.draw(tween.getValue() ?? 0),
    });
  }

  destroy(): void {
    this.tween?.stop();
    this.tween = null;
    this.graphics.destroy();
  }

  private draw(ms: number): void {
    const u = this.unit;
    const g = this.graphics;
    const pose = gesturePose(this.kind, ms);
    g.clear();

    g.fillStyle(0x1a1446, 0.08);
    g.fillRoundedRect(0, 0, GESTURE_ICON_WIDTH * u, GESTURE_ICON_HEIGHT * u, 10 * u);

    // Mini roof piece: eases a quarter turn per step (turnPulse is 1 right after a turn, then fades).
    const cx = 18 * u;
    const cy = 22 * u;
    const angle = (pose.turns - pose.turnPulse) * (Math.PI / 2);
    const roof = [
      { x: 0, y: -10 },
      { x: 10, y: 8 },
      { x: -10, y: 8 },
    ].map((p) => ({
      x: cx + (p.x * Math.cos(angle) - p.y * Math.sin(angle)) * u,
      y: cy + (p.x * Math.sin(angle) + p.y * Math.cos(angle)) * u,
    }));
    g.fillStyle(0xffc857, 1);
    g.fillPoints(roof, true);
    g.lineStyle(1.5 * u, 0x7a5a12, 1);
    g.strokePoints(roof, true);

    // Arc around the piece while it turns (hold gesture)
    if (pose.turnPulse > 0) {
      g.lineStyle(2 * u, 0x5ad1e0, pose.turnPulse);
      g.beginPath();
      g.arc(cx, cy, 16 * u, -1.1, 0.1);
      g.strokePath();
    }

    // Fingertip, dipping with the press, with a ripple per tap
    const fx = 44 * u;
    const fy = (24 + 4 * pose.press) * u;
    pose.ripples.forEach((strength) => {
      if (strength <= 0) return;
      g.lineStyle(1.5 * u, 0x7a5a12, strength * 0.8);
      g.strokeCircle(fx, 24 * u, (7 + 14 * (1 - strength)) * u);
    });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(fx, fy, 7 * u);
    g.lineStyle(1.5 * u, 0x7a5a12, 1);
    g.strokeCircle(fx, fy, 7 * u);
  }
}
