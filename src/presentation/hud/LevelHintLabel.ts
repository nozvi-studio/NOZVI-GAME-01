import Phaser from 'phaser';
import { COLOR_NUMBERS, DEPTH_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { isReducedMotion, scaleTiming } from '../transitions/motion.ts';

const FADE_MS = 240;

/**
 * Dòng gợi ý đầu màn: một viên thuốc chữ nằm giữa mép dưới bàn và khay mảnh, không che
 * bàn chơi. Hiện mờ dần khi vào màn, tắt mờ dần rồi tự huỷ khi người chơi làm đúng.
 */
export class LevelHintLabel {
  private container: Phaser.GameObjects.Container | null;

  constructor(scene: Phaser.Scene, layout: LayoutMetrics, text: string) {
    const { boardBounds: board, trayBounds: tray } = layout;
    const width = board.width - 16;
    const label = scene.add
      .text(0, 0, text, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '21px',
        color: '#FFFFFF',
        align: 'center',
        wordWrap: { width: width - 28, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const height = Math.max(44, label.height + 22);
    const bg = scene.add.graphics();
    bg.fillStyle(COLOR_NUMBERS.skyTop, 0.86);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(1.5, COLOR_NUMBERS.icePrimary, 0.7);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

    const gapTop = board.y + board.height;
    const centreY = gapTop + Math.max(height / 2 + 4, (tray.y - gapTop) / 2);
    this.container = scene.add
      .container(board.x + board.width / 2, centreY, [bg, label])
      .setDepth(DEPTH_TOKENS.placedPieces + 4);

    if (isReducedMotion()) return;
    this.container.setAlpha(0);
    scene.tweens.add({ targets: this.container, alpha: 1, duration: scaleTiming(FADE_MS), delay: scaleTiming(600) });
  }

  /** Tắt gợi ý: mờ dần rồi huỷ. Gọi lại là vô hại. */
  hide(scene: Phaser.Scene): void {
    const container = this.container;
    if (!container) return;
    this.container = null;
    if (isReducedMotion()) {
      container.destroy();
      return;
    }
    scene.tweens.killTweensOf(container);
    scene.tweens.add({ targets: container, alpha: 0, duration: scaleTiming(FADE_MS), onComplete: () => container.destroy() });
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
  }
}
