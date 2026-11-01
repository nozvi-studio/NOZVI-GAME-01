import type Phaser from 'phaser';
import { t } from '../i18n.ts';
import { adsServices } from '../adsServices.ts';
import { privacyServices, shortId } from '../privacyServices.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { createDialogCard } from './dialogCard.ts';
import { createLinkRow, createToggleRow } from './dialogRows.ts';

const ROW_STEP = 84;
const FIRST_ROW = 126;

export class PrivacyDialog {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private onCloseCallback?: () => void;

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    this.scene = scene;
    this.onCloseCallback = onClose;
  }

  public open(): void {
    if (this.container) return;
    playUiCue(this.scene, 'open');

    const scene = this.scene;
    const privacy = privacyServices(scene);
    const ads = adsServices(scene);
    const choices = privacy.choices;
    const rows: Array<(container: Phaser.GameObjects.Container, y: number) => void> = [];

    if (choices && privacy.offered.includes('analytics')) {
      rows.push((c, y) =>
        createToggleRow(scene, c, y, t('privacy_analytics'), choices.get().analytics, (on) =>
          choices.set({ analytics: on })
        )
      );
    }
    if (choices && privacy.offered.includes('diagnostics')) {
      rows.push((c, y) =>
        createToggleRow(scene, c, y, t('privacy_diagnostics'), choices.get().diagnostics, (on) =>
          choices.set({ diagnostics: on })
        )
      );
    }
    if (ads.privacyOptionsRequired()) {
      rows.push((c, y) => createLinkRow(scene, c, y, t('privacy_ads'), () => void ads.showPrivacyOptions()));
    }
    if (choices && privacy.offered.includes('analytics')) {
      rows.push((c, y) =>
        createLinkRow(
          scene,
          c,
          y,
          `${t('privacy_your_id')}: ${shortId(choices.userId())}  ·  ${t('privacy_copy')}`,
          () => {
            void navigator.clipboard?.writeText(choices.userId()).catch(() => {});
          }
        )
      );
    }
    if (privacy.policyUrl) {
      const url = privacy.policyUrl;
      rows.push((c, y) =>
        createLinkRow(scene, c, y, t('privacy_policy'), () => void window.open(url, '_blank', 'noopener'))
      );
    }

    // Title band + rows + bottom margin, so the card fits the rows present.
    const modalH = FIRST_ROW + rows.length * ROW_STEP + 60;
    const container = createDialogCard(scene, {
      title: t('privacy_title'),
      modalW: 620,
      modalH,
      depth: 160,
      onClose: () => this.close(),
    });
    this.container = container;
    rows.forEach((draw, i) => draw(container, -modalH / 2 + FIRST_ROW + i * ROW_STEP));
  }

  public close(): void {
    if (this.container) {
      playUiCue(this.scene, 'close');
      this.container.destroy();
      this.container = undefined;
      this.onCloseCallback?.();
    }
  }

  public isOpen(): boolean {
    return !!this.container;
  }
}
