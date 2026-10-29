import Phaser from 'phaser';
import { DEPTH_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { deviceTilt } from './deviceTilt.ts';
import { ensureSoftDotTexture } from './parallaxStars.ts';
import { mulberry32 } from './starField.ts';

const MOTE_COUNT = 10;
/** Design units a mote moves at full tilt; the board itself never moves, so drags stay exact. */
const TILT_REACH = 7;
const TINTS = [0xcfe6ff, 0x7fb8ff, 0xffd9a0] as const;

type Mote = {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Depth factor: nearer motes sweep further with the tilt. */
  depth: number;
  phase: number;
  alpha: number;
};

/**
 * A few faint motes between the sky and the board that lean with the device gyroscope (mouse
 * position on desktop). Sprites sharing one texture, only repositioned each frame.
 */
export class PlayTiltMotes {
  private readonly motes: Mote[];
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    const view = designViewBounds(scene);
    const key = ensureSoftDotTexture(scene);
    const random = mulberry32(2718);
    this.motes = Array.from({ length: MOTE_COUNT }, () => {
      const depth = 0.4 + random() * 0.6;
      const size = 3 + depth * 5;
      const alpha = 0.1 + random() * 0.14;
      const sprite = scene.add
        .image(0, 0, key)
        .setDepth(DEPTH_TOKENS.backgroundSky + 4)
        .setDisplaySize(size, size)
        .setTint(TINTS[Math.floor(random() * TINTS.length)])
        .setAlpha(alpha);
      return {
        sprite,
        x: view.x + random() * view.width,
        y: view.y + random() * view.height,
        depth,
        phase: random() * Math.PI * 2,
        alpha,
      };
    });
    this.update(0);
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const tilt = deviceTilt.getTilt();
    const t = this.elapsedMs / 1000;
    for (const mote of this.motes) {
      const bob = isReducedMotion() ? 0 : Math.sin(t * 0.5 + mote.phase) * 2;
      mote.sprite
        .setPosition(mote.x + tilt.x * TILT_REACH * mote.depth, mote.y + bob + tilt.y * TILT_REACH * mote.depth)
        .setAlpha(mote.alpha * (isReducedMotion() ? 1 : 0.8 + 0.2 * Math.sin(t * 1.3 + mote.phase)));
    }
  }

  destroy(): void {
    for (const mote of this.motes) mote.sprite.destroy();
    this.motes.length = 0;
  }
}
