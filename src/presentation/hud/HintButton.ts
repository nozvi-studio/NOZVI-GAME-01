import Phaser from 'phaser';
import { COLOR_TOKENS, DEPTH_TOKENS, FEEDBACK_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { isReducedMotion } from '../transitions/motion.ts';

/** Top right of the header: the slot of the retired target-eye button, so nothing else sits there. */
const HINT_X = 664;
const HINT_Y_IN_HEADER = 56;
const TOUCH = 96;

/** The "stuck" hint button: flies in from the right edge when the player has lost every star, then pulses. */
export class HintButton {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly hit: Phaser.GameObjects.Image;
  private pulse?: Phaser.Tweens.Tween;
  private shown = false;

  constructor(scene: Phaser.Scene, layout: LayoutMetrics, onTap: () => void) {
    this.scene = scene;
    const y = layout.headerBounds.y + HINT_Y_IN_HEADER;
    this.container = scene.add.container(HINT_X, y).setDepth(DEPTH_TOKENS.hudControls).setVisible(false);
    this.hit = scene.add.image(0, 0, TEXTURE_KEYS.btnCircle80).setSize(TOUCH, TOUCH);
    const mark = scene.add
      .text(0, -2, '?', {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '44px',
        color: COLOR_TOKENS.text.primary,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container.add([this.hit, mark]);
    this.hit.on('pointerdown', () => {
      playUiCue(scene, 'tap');
      onTap();
    });
  }

  isShown(): boolean {
    return this.shown;
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    const { flyInMs, startOffset, pulseMs, pulseScale } = FEEDBACK_TOKENS.hintButton;
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(true);
    this.hit.setInteractive({ useHandCursor: true });
    if (isReducedMotion()) {
      this.container.setPosition(HINT_X, this.container.y).setAlpha(1).setScale(1);
      return;
    }
    this.container.setPosition(HINT_X + startOffset, this.container.y).setAlpha(0).setScale(1);
    this.scene.tweens.add({
      targets: this.container,
      x: HINT_X,
      alpha: 1,
      duration: flyInMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.shown) return;
        this.pulse = this.scene.tweens.add({
          targets: this.container,
          scale: pulseScale,
          duration: pulseMs,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.pulse?.stop();
    this.pulse = undefined;
    this.hit.disableInteractive();
    this.scene.tweens.killTweensOf(this.container);
    if (isReducedMotion()) {
      this.container.setVisible(false);
      return;
    }
    this.scene.tweens.add({
      targets: this.container,
      x: HINT_X + FEEDBACK_TOKENS.hintButton.startOffset,
      alpha: 0,
      scale: 1,
      duration: FEEDBACK_TOKENS.hintButton.flyOutMs,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
  }

  destroy(): void {
    this.shown = false;
    this.pulse?.stop();
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
