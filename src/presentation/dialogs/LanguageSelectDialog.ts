import Phaser from 'phaser';
import { LOCALE_REGISTRY } from '../../localization/localizationConfig.ts';
import type { SupportedLocale } from '../../localization/types.ts';
import { COLOR_NUMBERS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { getLocale, setLocale, t } from '../i18n.ts';
import { playUiCue } from '../audio/uiCues.ts';

export class LanguageSelectDialog {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private onSelectCallback?: (locale: SupportedLocale) => void;

  constructor(scene: Phaser.Scene, onSelect?: (locale: SupportedLocale) => void) {
    this.scene = scene;
    this.onSelectCallback = onSelect;
  }

  public open(): void {
    if (this.container) return;
    playUiCue(this.scene, 'open');

    const view = designViewBounds(this.scene);
    this.container = this.scene.add.container(view.width / 2, view.height / 2).setDepth(900);

    // 1. Nền mờ 65%
    const backdrop = this.scene.add
      .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.65)
      .setInteractive();
    backdrop.on('pointerdown', () => this.close());

    // 2. Tấm panel modal chiêm tinh (460 x 500)
    const modalW = 460;
    const modalH = 700;
    const panel = this.scene.add.graphics();

    // Lớp bóng đổ mềm
    panel.fillStyle(0x050a1a, 0.65);
    panel.fillRoundedRect(-modalW / 2 + 4, -modalH / 2 + 8, modalW, modalH, 28);

    // Thân thẻ kính sapphire đậm
    panel.fillStyle(0x131b4d, 0.98);
    panel.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);

    // Viền kép ngọc băng và vàng chiêm tinh
    panel.lineStyle(3.5, 0x7fd8ff, 0.9);
    panel.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);
    panel.lineStyle(1.2, 0xffd23f, 0.45);
    panel.strokeRoundedRect(-modalW / 2 + 6, -modalH / 2 + 6, modalW - 12, modalH - 12, 22);

    // 3. Tiêu đề modal
    const title = this.scene.add
      .text(0, -modalH / 2 + 42, t('lang_modal_title'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '26px',
        color: '#FFD23F',
        stroke: '#22145A',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Nút đóng "X"
    const closeBtnBg = this.scene.add.graphics();
    closeBtnBg.fillStyle(0x0e1438, 1.0);
    closeBtnBg.fillCircle(modalW / 2 - 36, -modalH / 2 + 42 + 2, 18);
    closeBtnBg.fillStyle(0x273677, 1.0);
    closeBtnBg.fillCircle(modalW / 2 - 36, -modalH / 2 + 42, 18);
    closeBtnBg.lineStyle(2, 0x7fd8ff, 0.9);
    closeBtnBg.strokeCircle(modalW / 2 - 36, -modalH / 2 + 42, 18);

    const closeBtn = this.scene.add
      .image(modalW / 2 - 36, -modalH / 2 + 42, TEXTURE_KEYS.iconClose)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());

    this.container.add([backdrop, panel, title, closeBtnBg, closeBtn]);

    // 4. Danh sách 10 dòng chọn ngôn ngữ
    const currentLoc = getLocale();
    const locales = Object.values(LOCALE_REGISTRY);
    const rowW = 390;
    const rowH = 48;
    const startY = -modalH / 2 + 105;
    const rowGap = 56;

    locales.forEach((meta, idx) => {
      const rowY = startY + idx * rowGap;
      const isActive = meta.code === currentLoc;

      const rowBg = this.scene.add.graphics();
      if (isActive) {
        rowBg.fillStyle(0x24337a, 0.92);
        rowBg.fillRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
        rowBg.lineStyle(2.5, 0xffd54f, 1.0);
        rowBg.strokeRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
      } else {
        rowBg.fillStyle(0x151c4d, 0.65);
        rowBg.fillRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
        rowBg.lineStyle(1.2, 0x2e3c7c, 0.85);
        rowBg.strokeRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
      }

      // Cờ quốc gia
      const flagText = this.scene.add
        .text(-rowW / 2 + 28, rowY, meta.flagEmoji, {
          fontSize: '24px',
        })
        .setOrigin(0.5);

      // Tên ngôn ngữ bản địa
      const nameText = this.scene.add
        .text(-rowW / 2 + 60, rowY, meta.nativeName, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '18px',
          color: isActive ? '#FFD54F' : '#FFFFFF',
          fontStyle: isActive ? 'bold' : 'normal',
        })
        .setOrigin(0, 0.5);

      // Trạng thái chọn (Indicator badge)
      const indicator = this.scene.add.graphics();
      const indX = rowW / 2 - 28;
      if (isActive) {
        indicator.fillStyle(0xffd54f, 1.0);
        indicator.fillCircle(indX, rowY, 9);
        indicator.fillStyle(0x131b4d, 1.0);
        indicator.fillCircle(indX, rowY, 4);
      } else {
        indicator.lineStyle(2, 0x4a5a9c, 0.9);
        indicator.strokeCircle(indX, rowY, 9);
      }

      // Hit area tương tác
      const hitZone = this.scene.add
        .zone(0, rowY, rowW, rowH)
        .setInteractive({ useHandCursor: true });

      hitZone.on('pointerdown', () => {
        playUiCue(this.scene, 'tap');
        setLocale(meta.code);
        this.close();
        if (this.onSelectCallback) {
          this.onSelectCallback(meta.code);
        }
      });

      hitZone.on('pointerover', () => {
        if (!isActive) {
          rowBg.clear();
          rowBg.fillStyle(0x1d2968, 0.85);
          rowBg.fillRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
          rowBg.lineStyle(1.5, 0x7fd8ff, 0.9);
          rowBg.strokeRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
        }
      });

      hitZone.on('pointerout', () => {
        if (!isActive) {
          rowBg.clear();
          rowBg.fillStyle(0x151c4d, 0.65);
          rowBg.fillRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
          rowBg.lineStyle(1.2, 0x2e3c7c, 0.85);
          rowBg.strokeRoundedRect(-rowW / 2, rowY - rowH / 2, rowW, rowH, 16);
        }
      });

      this.container!.add([rowBg, flagText, nameText, indicator, hitZone]);
    });
  }

  public close(): void {
    if (!this.container) return;
    playUiCue(this.scene, 'close');
    this.container.destroy();
    this.container = undefined;
  }

  public destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }
  }
}
