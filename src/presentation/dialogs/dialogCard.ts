import type Phaser from 'phaser';
import { COLOR_NUMBERS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../../engine/core/viewport/designViewport.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { createDialogPanelInput } from './dialogInput.ts';

/**
 * Shared astrological card: dimmed backdrop, sapphire panel, title and round close button.
 * Returns the container with those parts already added; the caller adds its rows.
 */
export function createDialogCard(
  scene: Phaser.Scene,
  opts: { title: string; modalW: number; modalH: number; depth: number; onClose: () => void }
): Phaser.GameObjects.Container {
  const { modalW, modalH } = opts;
  const view = designViewBounds(scene);
  const container = scene.add.container(view.width / 2, view.height / 2).setDepth(opts.depth);

  // Nền mờ 65%
  const backdrop = scene.add
    .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.65)
    .setInteractive();

  const panel = scene.add.graphics();
  const panelInput = createDialogPanelInput(scene, backdrop, modalW, modalH, opts.onClose);

  // Lớp bóng đổ mềm
  panel.fillStyle(0x050a1a, 0.65);
  panel.fillRoundedRect(-modalW / 2 + 4, -modalH / 2 + 8, modalW, modalH, 28);

  // Thân thẻ kính saphire đậm
  panel.fillStyle(0x131b4d, 0.98);
  panel.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);

  // Viền kép ngọc băng và vàng chiêm tinh
  panel.lineStyle(3.5, 0x7fd8ff, 0.9);
  panel.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);
  panel.lineStyle(1.2, 0xffd23f, 0.45);
  panel.strokeRoundedRect(-modalW / 2 + 6, -modalH / 2 + 6, modalW - 12, modalH - 12, 22);

  // Tiêu đề
  const title = scene.add
    .text(0, -modalH / 2 + 50, opts.title, {
      fontFamily: TYPO_TOKENS.fontFamily.display,
      fontSize: '36px',
      color: '#FFD23F',
      stroke: '#22145A',
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  // Nút đóng "X" dạng kẹo tròn 3D
  const closeBtnBg = scene.add.graphics();
  closeBtnBg.fillStyle(0x0e1438, 1.0);
  closeBtnBg.fillCircle(modalW / 2 - 50, -modalH / 2 + 50 + 2, 28);
  closeBtnBg.fillStyle(0x273677, 1.0);
  closeBtnBg.fillCircle(modalW / 2 - 50, -modalH / 2 + 50, 28);
  closeBtnBg.lineStyle(2, 0x7fd8ff, 0.9);
  closeBtnBg.strokeCircle(modalW / 2 - 50, -modalH / 2 + 50, 28);

  const closeBtn = scene.add
    .image(modalW / 2 - 50, -modalH / 2 + 50, TEXTURE_KEYS.iconClose)
    .setDisplaySize(32, 32);
  const closeHit = scene.add
    .zone(modalW / 2 - 50, -modalH / 2 + 50, 64, 64)
    .setInteractive({ useHandCursor: true });
  closeHit.on('pointerdown', () => opts.onClose());

  container.add([backdrop, panel, panelInput, title, closeBtnBg, closeBtn, closeHit]);
  return container;
}
