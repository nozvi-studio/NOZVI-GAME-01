import type Phaser from 'phaser';
import { TYPO_TOKENS } from '../designTokens.ts';
import { t } from '../i18n.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { createDialogCard } from './dialogCard.ts';
import { createLinkRow } from './dialogRows.ts';
import { copyPrivacyId } from './copyPrivacyId.ts';

/** Preserve the current statistics ID before withdrawing consent rotates it. */
export function confirmWithdrawStats(scene: Phaser.Scene, userId: string): Promise<boolean> {
  return new Promise((resolve) => {
    playUiCue(scene, 'open');
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      playUiCue(scene, 'close');
      container.destroy();
      resolve(accepted);
    };
    const container = createDialogCard(scene, {
      title: t('privacy_withdraw_title'),
      modalW: 620,
      modalH: 680,
      depth: 170,
      onClose: () => finish(false),
    });
    const body = scene.add.text(0, -230, t('privacy_withdraw_body'), {
      fontFamily: TYPO_TOKENS.fontFamily.sans,
      fontSize: '24px',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 540, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    const id = scene.add.text(0, 0, userId, {
      fontFamily: TYPO_TOKENS.fontFamily.sans,
      fontSize: '22px',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 540, useAdvancedWrap: true },
    }).setOrigin(0.5);
    container.add([body, id]);
    const copy = createLinkRow(scene, container, 84, t('privacy_copy'), () => {
      void copyPrivacyId(userId, () => {
        if (!settled) copy.setText(`${t('privacy_copy')}  ·  ${t('privacy_copied')}`);
      });
    });
    createLinkRow(scene, container, 168, t('privacy_withdraw_confirm'), () => finish(true));
    createLinkRow(scene, container, 252, t('privacy_withdraw_cancel'), () => finish(false));
  });
}
