import { Capacitor } from '@capacitor/core';
import Phaser from 'phaser';
import type { ProgressRepository } from '../../application/progressPort.ts';
import { COLOR_NUMBERS, COLOR_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { t, getLocale, resetCosmicFacts } from '../i18n.ts';
import type { SupportedLocale } from '../../localization/types.ts';
import { setMotionScale } from '../transitions/motion.ts';
import { adsServices } from '../adsServices.ts';
import { audioServices } from '../audio/audioServices.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { createDialogPanelInput } from './dialogInput.ts';
import { LanguageSelectDialog } from './LanguageSelectDialog.ts';
import { LOCALE_REGISTRY } from '../../localization/localizationConfig.ts';
import { APP_VERSION } from '../../appVersion.ts';

export class SettingsDialog {
  private scene: Phaser.Scene;
  private progressRepo: ProgressRepository;
  private container?: Phaser.GameObjects.Container;
  private onCloseCallback?: () => void;

  constructor(scene: Phaser.Scene, progressRepo: ProgressRepository, onClose?: () => void) {
    this.scene = scene;
    this.progressRepo = progressRepo;
    this.onCloseCallback = onClose;
  }

  public open(): void {
    if (this.container) return;
    playUiCue(this.scene, 'open');

    const view = designViewBounds(this.scene);
    this.container = this.scene.add.container(view.width / 2, view.height / 2).setDepth(150);

    // 1. Nền mờ 65%
    const backdrop = this.scene.add
      .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.65)
      .setInteractive();

    // 2. Size the astrological card to the rows actually present on this device.
    const canVibrate =
      Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && 'vibrate' in navigator);
    const modalW = 620;
    // EEA/UK: the consent message must stay reachable so players can change their choice.
    const ads = adsServices(this.scene);
    const showPrivacy = ads.privacyOptionsRequired();
    const hapticsOffset = 462;
    const lastToggleOffset = canVibrate ? hapticsOffset : 378;
    const privacyOffset = lastToggleOffset + 84;
    const lastRowOffset = showPrivacy ? privacyOffset : lastToggleOffset;
    const dangerOffset = lastRowOffset + 84;
    // Room under the danger box for the version line.
    const versionRowH = 46;
    const modalH = dangerOffset + 72 / 2 + 34 + versionRowH;
    const panel = this.scene.add.graphics();
    const panelInput = createDialogPanelInput(this.scene, backdrop, modalW, modalH, () => this.close());

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

    // 3. Tiêu đề
    const title = this.scene.add
      .text(0, -modalH / 2 + 50, t('settings_title'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '36px',
        color: '#FFD23F',
        stroke: '#22145A',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    // Nút đóng "X" dạng kẹo tròn 3D
    const closeBtnBg = this.scene.add.graphics();
    closeBtnBg.fillStyle(0x0e1438, 1.0);
    closeBtnBg.fillCircle(modalW / 2 - 50, -modalH / 2 + 50 + 2, 28);
    closeBtnBg.fillStyle(0x273677, 1.0);
    closeBtnBg.fillCircle(modalW / 2 - 50, -modalH / 2 + 50, 28);
    closeBtnBg.lineStyle(2, 0x7fd8ff, 0.9);
    closeBtnBg.strokeCircle(modalW / 2 - 50, -modalH / 2 + 50, 28);

    const closeBtn = this.scene.add
      .image(modalW / 2 - 50, -modalH / 2 + 50, TEXTURE_KEYS.iconClose)
      .setDisplaySize(32, 32);
    const closeHit = this.scene.add
      .zone(modalW / 2 - 50, -modalH / 2 + 50, 64, 64)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => this.close());

    this.container.add([backdrop, panel, panelInput, title, closeBtnBg, closeBtn, closeHit]);

    // 4. Hàng chọn Ngôn ngữ (Language Switcher Row)
    this.createLanguageRow(-modalH / 2 + 126);

    // 5. Các tùy chọn Toggle
    // Toggle 'Bóng mục tiêu' (eye) retired: the dashed outline always shows the goal.

    // Toggle 2: Giảm chuyển động
    this.createToggleRow(
      -modalH / 2 + 210,
      t('setting_reduce_motion'),
      this.progressRepo.read().progress.settings.reducedMotion,
      (on) => {
        this.progressRepo.setReducedMotion(on);
        setMotionScale(on ? 0 : 1);
      }
    );

    const audio = audioServices(this.scene);
    const audioSettings = this.progressRepo.read().progress.settings;

    // Background music: fades out and pauses when off (spec G §5.1)
    this.createToggleRow(-modalH / 2 + 294, t('setting_music'), audioSettings.music, (on) => {
      this.progressRepo.setMusic(on);
      audio.music.setEnabled(on);
    });

    // Sound effects
    this.createToggleRow(-modalH / 2 + 378, t('setting_sfx'), audioSettings.sfx, (on) => {
      this.progressRepo.setSfx(on);
      audio.sfx.setEnabled(on);
    });

    // Toggle 3: Rung phản hồi — Android WebView không đáng tin ở navigator.vibrate,
    // nên hiện khi chạy native (plugin Haptics) hoặc trình duyệt có vibrate
    if (canVibrate) {
      this.createToggleRow(
        -modalH / 2 + hapticsOffset,
        t('setting_haptics'),
        this.progressRepo.read().progress.settings.haptics,
        (on) => {
          this.progressRepo.setHaptics(on);
        }
      );
    }

    if (showPrivacy) {
      this.createLinkRow(-modalH / 2 + privacyOffset, t('setting_privacy'), () => {
        void ads.showPrivacyOptions();
      });
    }

    // 6. Khu vực nguy hiểm: Xóa tiến trình chơi (tách biệt dưới đáy dạng badge)
    const dangerY = -modalH / 2 + dangerOffset;
    const dangerBox = this.scene.add.graphics();
    dangerBox.fillStyle(0x3d101e, 0.45);
    dangerBox.fillRoundedRect(-260, dangerY - 36, 520, 72, 28);
    dangerBox.lineStyle(1.4, 0xe65a5a, 0.65);
    dangerBox.strokeRoundedRect(-260, dangerY - 36, 520, 72, 28);

    const resetProgressBtn = this.scene.add
      .text(0, dangerY, `⚠️  ${t('setting_danger_reset')}`, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: '#FFA8A8',
      })
      .setOrigin(0.5);
    const resetHit = this.scene.add
      .zone(0, dangerY, 520, 72)
      .setInteractive({ useHandCursor: true });

    resetHit.on('pointerdown', () => {
      this.showDeleteConfirmation();
    });

    // 7. Phiên bản: để người chơi báo lỗi đúng bản (menu chính không còn hiện)
    const versionText = this.scene.add
      .text(0, dangerY + 36 + 38, t('loading_version', { version: APP_VERSION }), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '18px',
        color: '#7F88C2',
      })
      .setOrigin(0.5);

    this.container.add([dangerBox, resetProgressBtn, resetHit, versionText]);
  }

  /**
   * Hàng chọn ngôn ngữ 5 phân đoạn: [ VI | EN | ID | PT | JA ]
   */
  private createLanguageRow(y: number): void {
    if (!this.container) return;

    const current = getLocale();

    const rowLabel = this.scene.add
      .text(-270, y, t('setting_language'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: '#FFFFFF',
      })
      .setOrigin(0, 0.5);

    // Ten languages do not fit a segmented track: show the current one and open the language picker.
    const meta = LOCALE_REGISTRY[current as SupportedLocale] ?? LOCALE_REGISTRY['en-US'];
    const btnW = 340;
    const btnH = 56;
    const btnX = 100;

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x0e153b, 1.0);
    btnBg.fillRoundedRect(btnX - btnW / 2, y - btnH / 2, btnW, btnH, 17);
    btnBg.lineStyle(1.5, 0x3b4a82, 0.85);
    btnBg.strokeRoundedRect(btnX - btnW / 2, y - btnH / 2, btnW, btnH, 17);

    const flag = this.scene.add.text(btnX - btnW / 2 + 28, y, meta.flagEmoji, { fontSize: '24px' }).setOrigin(0.5);
    const name = this.scene.add
      .text(btnX - btnW / 2 + 60, y, meta.nativeName, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '20px',
        color: '#FFD54F',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const chevron = this.scene.add
      .text(btnX + btnW / 2 - 28, y, '›', {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '28px',
        color: '#7A89B8',
      })
      .setOrigin(0.5);
    const btnHit = this.scene.add.zone(btnX, y, btnW, 64).setInteractive({ useHandCursor: true });

    btnHit.on('pointerdown', () => {
      playUiCue(this.scene, 'tap');
      new LanguageSelectDialog(this.scene, () => {
        this.close();
        this.open();
        if ('buildMainMenu' in this.scene) {
          (this.scene as any).buildMainMenu(this.progressRepo.read().progress.completed);
        }
      }).open();
    });

    const divider = this.scene.add.graphics();
    divider.lineStyle(1, COLOR_NUMBERS.icePrimary, 0.15);
    divider.lineBetween(-270, y + 42, 270, y + 42);
    this.container.add([rowLabel, btnBg, flag, name, chevron, btnHit, divider]);
  }

  /** Row that opens something else (a form) when tapped: label on the left, chevron on the right. */
  private createLinkRow(y: number, label: string, onTap: () => void): void {
    if (!this.container) return;

    const rowLabel = this.scene.add
      .text(-270, y, label, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: '#FFFFFF',
        wordWrap: { width: 460, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);
    const chevron = this.scene.add
      .text(250, y, '›', {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '28px',
        color: '#7A89B8',
      })
      .setOrigin(0.5);
    const hitZone = this.scene.add.zone(0, y, 560, 84).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      playUiCue(this.scene, 'tap');
      onTap();
    });

    const divider = this.scene.add.graphics();
    divider.lineStyle(1, COLOR_NUMBERS.icePrimary, 0.15);
    divider.lineBetween(-270, y + 42, 270, y + 42);
    this.container.add([rowLabel, chevron, hitZone, divider]);
  }

  /**
   * Công tắc gạt 3D Juicy Switch
   */
  private createToggleRow(
    y: number,
    label: string,
    initialValue: boolean,
    onChange: (val: boolean) => void
  ): void {
    if (!this.container) return;

    let isChecked = initialValue;

    const rowLabel = this.scene.add
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

    const track = this.scene.add.graphics();
    const thumb = this.scene.add.graphics();

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

    const hitZone = this.scene.add
      .zone(0, y, 560, 84)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerdown', () => {
      isChecked = !isChecked;
      drawSwitch();
      onChange(isChecked);
      playUiCue(this.scene, 'tap');
    });

    const divider = this.scene.add.graphics();
    divider.lineStyle(1, COLOR_NUMBERS.icePrimary, 0.15);
    divider.lineBetween(-270, y + 42, 270, y + 42);
    this.container.add([rowLabel, track, thumb, hitZone, divider]);
  }

  /**
   * Hộp thoại xác nhận 2 bước cho thao tác xóa tiến trình nguy hiểm
   */
  private showDeleteConfirmation(): void {
    if (!this.container) return;

    const confirmContainer = this.scene.add.container(0, 0);
    const view = designViewBounds(this.scene);
    const overlay = this.scene.add
      .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.94)
      .setInteractive();
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x131b4d, 0.98);
    panel.fillRoundedRect(-300, -180, 600, 360, 28);
    panel.lineStyle(3.5, 0x7fd8ff, 0.9);
    panel.strokeRoundedRect(-300, -180, 600, 360, 28);
    panel.lineStyle(1.2, 0xffd23f, 0.45);
    panel.strokeRoundedRect(-294, -174, 588, 348, 22);
    const panelInput = createDialogPanelInput(this.scene, overlay, 600, 360, () => confirmContainer.destroy());

    const confirmText = this.scene.add
      .text(
        0,
        -64,
        t('reset_confirm_message'),
        {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '26px',
          color: COLOR_TOKENS.text.primary,
          align: 'center',
          lineSpacing: 8,
          wordWrap: { width: 520, useAdvancedWrap: true },
        }
      )
      .setOrigin(0.5);

    // Nút Hủy (Khối kính băng)
    const cancelBtnBg = this.scene.add.graphics();
    cancelBtnBg.fillStyle(COLOR_NUMBERS.boardSurfaceTop, 1.0);
    cancelBtnBg.fillRoundedRect(-244, 48, 232, 80, 20);
    cancelBtnBg.lineStyle(1.8, COLOR_NUMBERS.icePrimary, 0.85);
    cancelBtnBg.strokeRoundedRect(-244, 48, 232, 80, 20);

    const cancelBtn = this.scene.add
      .text(-128, 88, t('btn_cancel'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '26px',
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0.5);
    const cancelHit = this.scene.add
      .zone(-128, 88, 232, 80)
      .setInteractive({ useHandCursor: true });
    cancelHit.on('pointerdown', () => {
      confirmContainer.destroy();
    });

    // Nút Xác nhận xóa (Khối đỏ ruby 3D)
    const deleteBtnBg = this.scene.add.graphics();
    deleteBtnBg.fillStyle(0x7a1a1a, 1.0);
    deleteBtnBg.fillRoundedRect(12, 48, 232, 80, 20);
    deleteBtnBg.lineStyle(1.8, 0xe65a5a, 0.85);
    deleteBtnBg.strokeRoundedRect(12, 48, 232, 80, 20);

    const deleteBtn = this.scene.add
      .text(128, 88, t('btn_confirm_delete'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '26px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const deleteHit = this.scene.add
      .zone(128, 88, 232, 80)
      .setInteractive({ useHandCursor: true });
    deleteHit.on('pointerdown', () => {
      this.progressRepo.reset();
      resetCosmicFacts();
      confirmContainer.destroy();
      this.close();
      this.scene.scene.restart();
    });

    confirmContainer.add([overlay, panel, panelInput, confirmText, cancelBtnBg, cancelBtn, cancelHit, deleteBtnBg, deleteBtn, deleteHit]);
    this.container.add(confirmContainer);
  }

  public close(): void {
    if (this.container) {
      playUiCue(this.scene, 'close');
      this.container.destroy();
      this.container = undefined;
      this.onCloseCallback?.();
    }
  }
}
