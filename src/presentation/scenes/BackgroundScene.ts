import Phaser from 'phaser';
import { SkyBackdrop } from '../sky/SkyBackdrop.ts';
import { SKY_MOODS } from '../sky/skyMood.ts';
import type { MoodTarget, SkyMood } from '../sky/skyMood.ts';
import { applyDesignViewport } from '../../engine/core/viewport/designViewport.ts';

/**
 * Bầu trời duy nhất của cả game, luôn nằm dưới cùng. Menu, Bản đồ và Play
 * vẽ trong suốt phía trên, nên khi chuyển cảnh sao không bao giờ nhảy chỗ.
 */
export class BackgroundScene extends Phaser.Scene implements MoodTarget {
  private sky!: SkyBackdrop;

  constructor() {
    super({ key: 'BackgroundScene', active: true });
  }

  create(): void {
    applyDesignViewport(this);
    this.sky = new SkyBackdrop(this, { seed: 1, driftSpeed: 0 });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.sky.spawnRipple(pointer.x, pointer.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.sky.setPointerOffset(pointer.x, pointer.y);
    });

    const onRipple = (x: number, y: number, color?: number, maxR?: number): void => {
      this.sky.spawnRipple(x, y, color, maxR);
    };
    // game.events outlives this scene, so drop the listener or a restart stacks a second one.
    this.game.events.on('ethereal:ripple', onRipple);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('ethereal:ripple', onRipple);
    });
  }

  update(_time: number, delta: number): void {
    this.sky.update(delta);
  }

  spawnRipple(x: number, y: number, color?: number, maxR?: number): void {
    if (this.sky) {
      this.sky.spawnRipple(x, y, color, maxR);
    }
  }

  setMood(mood: SkyMood, durationMs: number): void {
    if (!this.sky) return;
    const target = SKY_MOODS[mood];
    this.tweens.killTweensOf(this.sky.moodState);
    if (durationMs <= 0) {
      Object.assign(this.sky.moodState, target);
      return;
    }
    this.tweens.add({
      targets: this.sky.moodState,
      driftSpeed: target.driftSpeed,
      dim: target.dim,
      duration: durationMs,
      ease: 'Sine.easeInOut',
    });
  }

  /** Chuỗi thắng: trời tối thêm `extraDim` so với mood play. setMood kế tiếp sẽ đưa về. */
  deepen(extraDim: number, durationMs: number): void {
    if (!this.sky) return;
    this.tweens.killTweensOf(this.sky.moodState);
    this.tweens.add({
      targets: this.sky.moodState,
      dim: SKY_MOODS.play.dim + extraDim,
      duration: durationMs,
      ease: 'Sine.easeOut',
    });
  }

  /** Thắng cuộc: bầu trời thắp sáng bừng lên (dim về 0) và sao trôi lấp lánh tương tác */
  celebrateVictory(durationMs: number): void {
    if (!this.sky) return;
    this.tweens.killTweensOf(this.sky.moodState);
    this.tweens.add({
      targets: this.sky.moodState,
      dim: 0,
      driftSpeed: 2.5,
      duration: durationMs,
      ease: 'Sine.easeOut',
    });
  }
}
