import Phaser from 'phaser';
import { SkyBackdrop } from '../sky/SkyBackdrop.ts';
import { SKY_MOODS } from '../sky/skyMood.ts';
import type { MoodTarget, SkyMood } from '../sky/skyMood.ts';
import { applyDesignViewport } from '../designViewport.ts';

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
  }

  update(_time: number, delta: number): void {
    this.sky.update(delta);
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
