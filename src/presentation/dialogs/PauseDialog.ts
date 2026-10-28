import Phaser from 'phaser';
import { COLOR_NUMBERS, COLOR_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { getLocale, t } from '../i18n.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { LOCALE_REGISTRY } from '../../localization/localizationConfig.ts';
import type { SupportedLocale } from '../../localization/types.ts';
import { createDialogPanelInput } from './dialogInput.ts';
import { LanguageSelectDialog } from './LanguageSelectDialog.ts';

export type PauseCallbacks = {
  onResume: () => void;
  onRestart: () => void;
  onLevelSelect: () => void;
  /** Music and effects switches under the title; both rows are hidden when omitted. */
  audio?: PauseAudio;
  /** Shows the language row first; called after the player picks a language. */
  onLanguageChange?: () => void;
};

export type PauseAudio = {
  isMusicOn: () => boolean;
  isSfxOn: () => boolean;
  setMusic: (on: boolean) => void;
  setSfx: (on: boolean) => void;
};

export class PauseDialog {
  private scene: Phaser.Scene;
  private callbacks: PauseCallbacks;
  private container?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, callbacks: PauseCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  public open(): void {
    if (this.container) return;
    playUiCue(this.scene, 'open');

    const view = designViewBounds(this.scene);
    this.container = this.scene.add.container(view.width / 2, view.height / 2).setDepth(150);

    // 1. Lớp phủ đen mờ 65%
    const backdrop = this.scene.add
      .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.65)
      .setInteractive();

    // 2. Astrological card panel, with room for full-width touch targets.
    const modalW = 600;
    // Language and the two switches sit in rows between the title and the buttons.
    const ROW_H = 72;
    const rows = (this.callbacks.onLanguageChange ? 1 : 0) + (this.callbacks.audio ? 2 : 0);
    const audioH = rows ? 22 + rows * ROW_H : 0;
    const modalH = 330 + audioH;
    const panel = this.scene.add.graphics();
    const panelInput = createDialogPanelInput(this.scene, backdrop, modalW, modalH, () => this.close());

    // Lớp bóng đổ mềm
    panel.fillStyle(0x050a1a, 0.65);
    panel.fillRoundedRect(-modalW / 2 + 4, -modalH / 2 + 8, modalW, modalH, 28);

    // Thân thẻ kính saphire đậm
    panel.fillStyle(0x131b4d, 0.98);
    panel.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);

    // Viền kép: Viền ngoài băng lam ngọc và viền trong vàng chiêm tinh
    panel.lineStyle(3.5, 0x7fd8ff, 0.9);
    panel.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);
    panel.lineStyle(1.2, 0xffd23f, 0.45);
    panel.strokeRoundedRect(-modalW / 2 + 6, -modalH / 2 + 6, modalW - 12, modalH - 12, 22);

    // 3. Tiêu đề TẠM DỪNG (Baloo 2 nổi bật)
    const title = this.scene.add
      .text(0, -modalH / 2 + 58, t('pause_title'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '40px',
        color: '#FFD23F',
        stroke: '#22145A',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // 4. Ba nút điều hướng theo thứ tự ưu tiên thị giác
    const btnW = 500;

    // A. Nút 1: Tiếp tục chơi (Khối vàng hổ phách 3D tactile)
    const btn1Y = -modalH / 2 + 128 + audioH;
    const btn1H = 88;
    const btn1Container = this.scene.add.container(0, btn1Y);

    const btn1Shadow = this.scene.add.graphics();
    btn1Shadow.fillStyle(0x22145a, 1.0);
    btn1Shadow.fillRoundedRect(-btnW / 2, -btn1H / 2 + 5, btnW, btn1H, 20);

    const btn1Face = this.scene.add.graphics();
    btn1Face.fillStyle(0xffa800, 1.0);
    btn1Face.fillRoundedRect(-btnW / 2, -btn1H / 2, btnW, btn1H - 3, 20);
    btn1Face.fillStyle(0xffd54f, 0.95);
    btn1Face.fillRoundedRect(-btnW / 2 + 2, -btn1H / 2 + 2, btnW - 4, (btn1H - 6) * 0.65, 18);
    btn1Face.fillStyle(0xffffff, 0.3);
    btn1Face.fillRoundedRect(-btnW / 2 + 14, -btn1H / 2 + 4, btnW - 28, 12, 6);
    btn1Face.lineStyle(2.5, 0x3b2779, 1.0);
    btn1Face.strokeRoundedRect(-btnW / 2, -btn1H / 2, btnW, btn1H, 20);

    // Icon tam giác Play
    const playIcon = this.scene.add.graphics();
    playIcon.fillStyle(0x22145a, 1.0);
    playIcon.beginPath();
    playIcon.moveTo(-btnW / 2 + 30, -8);
    playIcon.lineTo(-btnW / 2 + 42, 0);
    playIcon.lineTo(-btnW / 2 + 30, 8);
    playIcon.closePath();
    playIcon.fillPath();

    const btn1Text = this.scene.add
      .text(10, -2, t('pause_resume'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '30px',
        color: '#22145A',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const btn1Zone = this.scene.add
      .zone(0, 0, btnW, btn1H)
      .setInteractive({ useHandCursor: true });

    btn1Zone.on('pointerdown', () => {
      btn1Container.y = btn1Y + 3;
      btn1Container.setScale(0.97);
    });

    btn1Zone.on('pointerup', () => {
      btn1Zone.disableInteractive();
      this.scene.tweens.add({
        targets: btn1Container,
        y: btn1Y,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.close();
          this.callbacks.onResume();
        },
      });
    });

    btn1Zone.on('pointerout', () => {
      btn1Container.y = btn1Y;
      btn1Container.setScale(1);
    });

    btn1Container.add([btn1Shadow, btn1Face, playIcon, btn1Text, btn1Zone]);

    // Restart and level select share one row under Resume.
    const rowGap = 12;
    const halfW = (btnW - rowGap) / 2;
    // B. Nút 2: Chơi lại màn này (Khối kính băng lam ngọc 3D)
    const btn2Y = btn1Y + 112;
    const btn2H = 88;
    const btn2Container = this.scene.add.container(-halfW / 2 - rowGap / 2, btn2Y);

    const btn2Shadow = this.scene.add.graphics();
    btn2Shadow.fillStyle(0x0e1438, 1.0);
    btn2Shadow.fillRoundedRect(-halfW / 2, -btn2H / 2 + 4, halfW, btn2H, 18);

    const btn2Face = this.scene.add.graphics();
    btn2Face.fillStyle(COLOR_NUMBERS.boardSurfaceTop, 0.92);
    btn2Face.fillRoundedRect(-halfW / 2, -btn2H / 2, halfW, btn2H - 2, 18);
    btn2Face.fillStyle(0xffffff, 0.14);
    btn2Face.fillRoundedRect(-halfW / 2 + 10, -btn2H / 2 + 3, halfW - 20, 10, 5);
    btn2Face.lineStyle(2.0, COLOR_NUMBERS.icePrimary, 0.95);
    btn2Face.strokeRoundedRect(-halfW / 2, -btn2H / 2, halfW, btn2H - 2, 18);

    const btn2Text = this.scene.add
      .text(0, -1, t('pause_restart'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: '#FFFFFF',
        stroke: '#141C48',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: halfW - 36, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const btn2Zone = this.scene.add
      .zone(0, 0, halfW, btn2H)
      .setInteractive({ useHandCursor: true });

    btn2Zone.on('pointerdown', () => {
      btn2Container.y = btn2Y + 2;
      btn2Container.setScale(0.97);
    });

    btn2Zone.on('pointerup', () => {
      btn2Zone.disableInteractive();
      this.scene.tweens.add({
        targets: btn2Container,
        y: btn2Y,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.close();
          this.callbacks.onRestart();
        },
      });
    });

    btn2Zone.on('pointerout', () => {
      btn2Container.y = btn2Y;
      btn2Container.setScale(1);
    });

    btn2Container.add([btn2Shadow, btn2Face, btn2Text, btn2Zone]);

    // C. Nút 3: Về chọn màn (Khối kính tím mờ trang nhã)
    const btn3Y = btn2Y;
    const btn3H = 88;
    const btn3Container = this.scene.add.container(halfW / 2 + rowGap / 2, btn3Y);

    const btn3Face = this.scene.add.graphics();
    btn3Face.fillStyle(0x161e44, 0.85);
    btn3Face.fillRoundedRect(-halfW / 2, -btn3H / 2, halfW, btn3H, 16);
    btn3Face.lineStyle(2.5, COLOR_NUMBERS.icePrimary, 0.95);
    btn3Face.strokeRoundedRect(-halfW / 2, -btn3H / 2, halfW, btn3H, 16);

    const btn3Text = this.scene.add
      .text(0, 0, t('pause_level_select'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: COLOR_TOKENS.text.primary,
        align: 'center',
        wordWrap: { width: halfW - 36, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const btn3Zone = this.scene.add
      .zone(0, 0, halfW, btn3H)
      .setInteractive({ useHandCursor: true });

    btn3Zone.on('pointerdown', () => {
      btn3Container.y = btn3Y + 2;
      btn3Container.setScale(0.97);
    });

    btn3Zone.on('pointerup', () => {
      btn3Zone.disableInteractive();
      this.scene.tweens.add({
        targets: btn3Container,
        y: btn3Y,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.close();
          this.callbacks.onLevelSelect();
        },
      });
    });

    btn3Zone.on('pointerout', () => {
      btn3Container.y = btn3Y;
      btn3Container.setScale(1);
    });

    btn3Container.add([btn3Face, btn3Text, btn3Zone]);

    this.container.add([backdrop, panel, panelInput, title, btn1Container, btn2Container, btn3Container]);
    let rowY = -modalH / 2 + 58 + ROW_H;
    if (this.callbacks.onLanguageChange) {
      this.addLanguageRow(rowY);
      rowY += ROW_H;
    }
    const audio = this.callbacks.audio;
    if (audio) {
      this.addToggleRow(rowY, t('setting_music'), audio.isMusicOn(), audio.setMusic);
      this.addToggleRow(rowY + ROW_H, t('setting_sfx'), audio.isSfxOn(), audio.setSfx);
    }
  }

  /** Label on the left and the current language on the right; tapping opens the picker. */
  private addLanguageRow(y: number): void {
    if (!this.container) return;
    const meta = LOCALE_REGISTRY[getLocale() as SupportedLocale] ?? LOCALE_REGISTRY['en-US'];
    const label = this.scene.add
      .text(-230, y, t('setting_language'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '26px',
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0, 0.5);
    const btnW = 270;
    const btnH = 52;
    const btnX = 115;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0e153b, 1.0);
    bg.fillRoundedRect(btnX - btnW / 2, y - btnH / 2, btnW, btnH, 16);
    bg.lineStyle(1.5, 0x3b4a82, 0.85);
    bg.strokeRoundedRect(btnX - btnW / 2, y - btnH / 2, btnW, btnH, 16);
    const flag = this.scene.add.text(btnX - btnW / 2 + 26, y, meta.flagEmoji, { fontSize: '24px' }).setOrigin(0.5);
    const name = this.scene.add
      .text(btnX - btnW / 2 + 54, y, meta.nativeName, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '20px',
        color: '#FFD54F',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const chevron = this.scene.add
      .text(btnX + btnW / 2 - 24, y, '›', {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '28px',
        color: '#7A89B8',
      })
      .setOrigin(0.5);
    const hit = this.scene.add.zone(btnX, y, btnW, 64).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      playUiCue(this.scene, 'tap');
      new LanguageSelectDialog(this.scene, () => {
        // Rebuild so this dialog's own labels switch language too.
        this.close();
        this.open();
        this.callbacks.onLanguageChange?.();
      }).open();
    });
    this.container.add([label, bg, flag, name, chevron, hit]);
  }

  /** Label on the left and a switch on the right, like the rows in Settings. */
  private addToggleRow(y: number, labelText: string, initial: boolean, onChange: (on: boolean) => void): void {
    if (!this.container) return;
    let on = initial;
    const label = this.scene.add
      .text(-230, y, labelText, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '26px',
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0, 0.5);
    const trackW = 76;
    const trackH = 42;
    const switchX = 212;
    const track = this.scene.add.graphics();
    const thumb = this.scene.add.graphics();
    const draw = () => {
      track.clear();
      thumb.clear();
      if (on) {
        track.fillStyle(0xffa800, 1.0);
        track.fillRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
        track.fillStyle(0xffd54f, 0.95);
        track.fillRoundedRect(switchX - trackW / 2 + 2, y - trackH / 2 + 2, trackW - 4, trackH * 0.55, 14);
        track.lineStyle(2.0, 0x3b2779, 1.0);
        track.strokeRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
        thumb.fillStyle(0x22145a, 1.0);
        thumb.fillCircle(switchX + 17, y, 16);
        thumb.fillStyle(0xffffff, 0.75);
        thumb.fillCircle(switchX + 13, y - 4, 4);
      } else {
        track.fillStyle(0x0e153b, 1.0);
        track.fillRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
        track.lineStyle(1.8, 0x3b4a82, 0.85);
        track.strokeRoundedRect(switchX - trackW / 2, y - trackH / 2, trackW, trackH, 16);
        thumb.fillStyle(0x6d7ca8, 1.0);
        thumb.fillCircle(switchX - 17, y, 16);
        thumb.fillStyle(0xffffff, 0.5);
        thumb.fillCircle(switchX - 21, y - 4, 4);
      }
    };
    draw();
    const hit = this.scene.add.zone(0, y, 520, 64).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      on = !on;
      draw();
      onChange(on);
      playUiCue(this.scene, 'tap');
    });
    this.container.add([label, track, thumb, hit]);
  }

  public close(): void {
    if (this.container) {
      playUiCue(this.scene, 'close');
      this.container.destroy();
      this.container = undefined;
    }
  }

  public isOpen(): boolean {
    return this.container !== undefined;
  }
}
