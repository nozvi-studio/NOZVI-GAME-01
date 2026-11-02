import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmWithdrawStats } from '../src/presentation/dialogs/WithdrawStatsDialog.ts';
import { t } from '../src/presentation/i18n.ts';
import { fakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

describe('confirmWithdrawStats', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([true, false])('resolves %s from equal action rows and destroys its card', async (accepted) => {
    const ui = fakeScene({});
    const result = confirmWithdrawStats(ui.scene, 'current-full-id');
    expect(ui.root().depth).toBe(170);
    const confirm = ui.items.find((i) => i.text === t('privacy_withdraw_confirm'))!;
    const cancel = ui.items.find((i) => i.text === t('privacy_withdraw_cancel'))!;
    const zoneAt = (y: number) => ui.items.find((i) => i.kind === 'zone' && i.y === y)!;
    expect(zoneAt(confirm.y).width).toBe(zoneAt(cancel.y).width);
    expect(zoneAt(confirm.y).height).toBe(zoneAt(cancel.y).height);
    ui.tap(0, accepted ? confirm.y : cancel.y);
    await expect(result).resolves.toBe(accepted);
    expect(ui.root().destroyed).toBe(true);
  });

  it.each(['missing', 'rejected', 'throws'])('silently leaves Copy unchanged when clipboard access is %s', async (failure) => {
    const writeText = vi.fn(() => {
      if (failure === 'throws') throw new Error('clipboard denied');
      return Promise.reject(new Error('clipboard denied'));
    });
    vi.stubGlobal('navigator', failure === 'missing' ? {} : { clipboard: { writeText } });
    const ui = fakeScene({});
    const result = confirmWithdrawStats(ui.scene, 'current-full-id');
    const copy = ui.items.find((i) => i.text === t('privacy_copy'))!;
    ui.tap(0, copy.y);
    await Promise.resolve();
    expect(copy.text).toBe(t('privacy_copy'));
    expect(ui.root().destroyed).toBe(false);
    ui.tap(0, ui.items.find((i) => i.text === t('privacy_withdraw_cancel'))!.y);
    await expect(result).resolves.toBe(false);
  });
});
