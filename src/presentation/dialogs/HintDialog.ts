import Phaser from 'phaser';
import { COLOR_NUMBERS, COLOR_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { designViewBounds } from '../designViewport.ts';
import { t } from '../i18n.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { createDialogPanelInput } from './dialogInput.ts';

export type HintCallbacks = {
  /** The player agreed to watch an ad for the hint. */
  onWatch: () => void;
  onCancel: () => void;
};

/** "Watch an ad to place one piece?" The ad only starts after the player taps Watch (rewarded ads need opt-in). */
export class HintDialog {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: HintCallbacks;
  private container?: Phaser.GameObjects.Container;
  private status?: Phaser.GameObjects.Text;
  private watchButton?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, callbacks: HintCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  public open(): void {
    if (this.container) return;
    playUiCue(this.scene, 'open');

    const view = designViewBounds(this.scene);
    const container = this.scene.add.container(view.width / 2, view.height / 2).setDepth(150);
    this.container = container;

    const modalW = 600;
    const modalH = 470;
    const backdrop = this.scene.add
      .rectangle(0, 0, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 0.65)
      .setInteractive();
    const panelInput = createDialogPanelInput(this.scene, backdrop, modalW, modalH, () => this.cancel());

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x050a1a, 0.65);
    panel.fillRoundedRect(-modalW / 2 + 4, -modalH / 2 + 8, modalW, modalH, 28);
    panel.fillStyle(0x131b4d, 0.98);
    panel.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);
    panel.lineStyle(3.5, 0x7fd8ff, 0.9);
    panel.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 28);
    panel.lineStyle(1.2, 0xffd23f, 0.45);
    panel.strokeRoundedRect(-modalW / 2 + 6, -modalH / 2 + 6, modalW - 12, modalH - 12, 22);

    const title = this.scene.add
      .text(0, -modalH / 2 + 58, t('hint_title'), {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '40px',
        color: '#FFD23F',
        stroke: '#22145A',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const body = this.scene.add
      .text(0, -modalH / 2 + 148, t('hint_body'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '26px',
        color: COLOR_TOKENS.text.primary,
        align: 'center',
        wordWrap: { width: modalW - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    // Filled only when no ad could be shown; the dialog stays so the player can try again.
    this.status = this.scene.add
      .text(0, -modalH / 2 + 222, '', {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '22px',
        color: '#FFA8A8',
        align: 'center',
        wordWrap: { width: modalW - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const btnW = 500;
    const watchY = modalH / 2 - 146;
    const watch = this.makeButton(0, watchY, btnW, 88, t('hint_watch'), true, () => {
      this.status?.setText('');
      this.callbacks.onWatch();
    });
    this.watchButton = watch;
    const cancel = this.makeButton(0, modalH / 2 - 58, btnW, 72, t('btn_cancel'), false, () => this.cancel());

    container.add([backdrop, panel, panelInput, title, body, this.status, watch, cancel]);
  }

  /** While the ad loads: dim Watch and show a pending mark, so a tap is not met with silence. */
  public setLoading(on: boolean): void {
    this.watchButton?.setAlpha(on ? 0.5 : 1);
    this.status?.setColor(on ? COLOR_TOKENS.text.primary : '#FFA8A8').setText(on ? '...' : '');
  }

  /** The ad could not be shown: say so and keep the dialog open. */
  public showNoAd(): void {
    this.status?.setText(t('hint_no_ad'));
  }

  public close(): void {
    this.container?.destroy();
    this.container = undefined;
    this.status = undefined;
    this.watchButton = undefined;
  }

  public isOpen(): boolean {
    return this.container !== undefined;
  }

  private cancel(): void {
    this.close();
    this.callbacks.onCancel();
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    primary: boolean,
    onTap: () => void
  ): Phaser.GameObjects.Container {
    const button = this.scene.add.container(x, y);
    const face = this.scene.add.graphics();
    if (primary) {
      face.fillStyle(0x22145a, 1);
      face.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 20);
      face.fillStyle(0xffa800, 1);
      face.fillRoundedRect(-w / 2, -h / 2, w, h - 3, 20);
      face.fillStyle(0xffd54f, 0.95);
      face.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, (h - 6) * 0.65, 18);
      face.lineStyle(2.5, 0x3b2779, 1);
      face.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
    } else {
      face.fillStyle(0x161e44, 0.85);
      face.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      face.lineStyle(2.5, COLOR_NUMBERS.icePrimary, 0.95);
      face.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    }
    const text = this.scene.add
      .text(0, -1, label, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: primary ? '30px' : '24px',
        color: primary ? '#22145A' : COLOR_TOKENS.text.primary,
        fontStyle: primary ? 'bold' : 'normal',
        align: 'center',
        wordWrap: { width: w - 40, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
    const zone = this.scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      playUiCue(this.scene, 'tap');
      onTap();
    });
    button.add([face, text, zone]);
    return button;
  }
}
