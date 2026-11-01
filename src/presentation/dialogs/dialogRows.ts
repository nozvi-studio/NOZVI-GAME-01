import type Phaser from 'phaser';
import { COLOR_NUMBERS, TYPO_TOKENS } from '../designTokens.ts';
import { playUiCue } from '../audio/uiCues.ts';

/** Row that opens something else (a form) when tapped: label on the left, chevron on the right. */
export function createLinkRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  y: number,
  label: string,
  onTap: () => void
): Phaser.GameObjects.Text {
  const rowLabel = scene.add
    .text(-270, y, label, {
      fontFamily: TYPO_TOKENS.fontFamily.display,
      fontSize: '24px',
      color: '#FFFFFF',
      wordWrap: { width: 460, useAdvancedWrap: true },
    })
    .setOrigin(0, 0.5);
  const chevron = scene.add
    .text(250, y, '›', {
      fontFamily: TYPO_TOKENS.fontFamily.display,
      fontSize: '28px',
      color: '#7A89B8',
    })
    .setOrigin(0.5);
  const hitZone = scene.add.zone(0, y, 560, 84).setInteractive({ useHandCursor: true });
  hitZone.on('pointerdown', () => {
    playUiCue(scene, 'tap');
    onTap();
  });

  const divider = scene.add.graphics();
  divider.lineStyle(1, COLOR_NUMBERS.icePrimary, 0.15);
  divider.lineBetween(-270, y + 42, 270, y + 42);
  container.add([rowLabel, chevron, hitZone, divider]);
  return rowLabel;
}

/** Công tắc gạt 3D Juicy Switch */
export function createToggleRow(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  y: number,
  label: string,
  initialValue: boolean,
  onChange: (val: boolean) => void
): void {
  let isChecked = initialValue;

  const rowLabel = scene.add
    .text(-270, y, label, {
      fontFamily: TYPO_TOKENS.fontFamily.display,
      fontSize: '24px',
      color: '#FFFFFF',
      wordWrap: { width: 420, useAdvancedWrap: true },
    })
    .setOrigin(0, 0.5);

  // Switch Track bo tròn dày dặn
  const trackW = 76;
  const trackH = 42;
  const switchX = 230;

  const track = scene.add.graphics();
  const thumb = scene.add.graphics();

  const drawSwitch = () => {
    track.clear();
    thumb.clear();

    if (isChecked) {
      // Track màu vàng hổ phách nổi khối
      track.fillStyle(0xffa800, 1.0);
      track.fillRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
      track.fillStyle(0xffd54f, 0.95);
      track.fillRoundedRect(switchX - trackW / 2 + 2, y - trackH / 2 + 2, trackW - 4, trackH * 0.55, 14);
      track.lineStyle(2.0, 0x3b2779, 1.0);
      track.strokeRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);

      // Thumb tròn to nổi khối ở bên phải
      const thumbX = switchX + 17;
      thumb.fillStyle(0x140d33, 0.4);
      thumb.fillCircle(thumbX, y + 2, 16);
      thumb.fillStyle(0x22145a, 1.0);
      thumb.fillCircle(thumbX, y, 16);
      thumb.fillStyle(0xffffff, 0.75);
      thumb.fillCircle(thumbX - 4, y - 4, 4);
    } else {
      // Track tối màu khi tắt
      track.fillStyle(0x0e153b, 1.0);
      track.fillRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
      track.lineStyle(1.8, 0x3b4a82, 0.85);
      track.strokeRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);

      // Thumb xám bạc ở bên trái
      const thumbX = switchX - 17;
      thumb.fillStyle(0x6d7ca8, 1.0);
      thumb.fillCircle(thumbX, y, 16);
      thumb.fillStyle(0xffffff, 0.5);
      thumb.fillCircle(thumbX - 4, y - 4, 4);
    }
  };

  drawSwitch();

  const hitZone = scene.add.zone(0, y, 560, 84).setInteractive({ useHandCursor: true });

  hitZone.on('pointerdown', () => {
    isChecked = !isChecked;
    drawSwitch();
    onChange(isChecked);
    playUiCue(scene, 'tap');
  });

  const divider = scene.add.graphics();
  divider.lineStyle(1, COLOR_NUMBERS.icePrimary, 0.15);
  divider.lineBetween(-270, y + 42, 270, y + 42);
  container.add([rowLabel, track, thumb, hitZone, divider]);
}
