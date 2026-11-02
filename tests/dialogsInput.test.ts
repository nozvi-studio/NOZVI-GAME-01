import { Capacitor } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PauseDialog } from '../src/presentation/dialogs/PauseDialog.ts';
import { HintDialog } from '../src/presentation/dialogs/HintDialog.ts';
import { SettingsDialog } from '../src/presentation/dialogs/SettingsDialog.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import { getLocale, setLocale, t } from '../src/presentation/i18n.ts';
import type { AdsPort } from '../src/engine/core/platform/platformPort.ts';
import { NO_ADS } from '../src/presentation/adsServices.ts';
import { fakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => true) } }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

function setup(ads?: AdsPort) {
  const { scene, items, root, send, tap, restart } = fakeScene({ ads });
  const storage = new Map<string, string>();
  const repo = createProgressRepository({ getItem: k => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v); } }, [], 'test');
  const onClose = vi.fn();
  const settings = new SettingsDialog(scene, repo, onClose);
  const callbacks = { onResume: vi.fn(), onRestart: vi.fn(), onLevelSelect: vi.fn() };
  const pause = new PauseDialog(scene, callbacks);
  const hintCallbacks = { onWatch: vi.fn(), onCancel: vi.fn() };
  const hintDialog = new HintDialog(scene, hintCallbacks);
  return { items, root, send, tap, settings, pause, callbacks, repo, restart, onClose, hintDialog, hintCallbacks };
}

beforeEach(() => {
  setLocale('en-US');
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
});

describe.each(['pause', 'settings'] as const)('%s dialog input boundary', (kind) => {
  it('keeps empty panel taps and inside-to-outside drags open', () => {
    const ui = setup();
    ui[kind].open();
    ui.tap(-285, 0);
    expect(ui.root().destroyed).toBe(false);
    ui.send('pointerdown', -285, 0);
    ui.send('pointerup', -340, 0);
    expect(ui.root().destroyed).toBe(false);
    expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('closes only after an outside press and release from the same pointer', () => {
    const ui = setup();
    ui[kind].open();
    ui.send('pointerdown', -340, 0);
    expect(ui.root().destroyed).toBe(false);
    ui.send('pointerup', -340, 0, 2);
    expect(ui.root().destroyed).toBe(false);
    ui.send('pointerup', -340, 0);
    expect(ui.root().destroyed).toBe(true);
  });
});

it('makes the full pause buttons touchable with comfortable gaps', () => {
  const ui = setup();
  ui.pause.open();
  const buttons = ui.root().children.filter(i => i.kind === 'container');
  expect(buttons).toHaveLength(3);
  const zones = buttons.map(b => b.children.find(i => i.interactive)!);
  // Resume stands alone at full width; restart and level select share the row under it.
  expect(zones.map(z => [z.width, z.height])).toEqual([[500, 88], [244, 88], [244, 88]]);
  expect(buttons[1].y).toBe(buttons[2].y);
  expect(buttons[1].y - buttons[0].y - 88).toBe(24);
  expect(buttons[2].x - buttons[1].x - 244).toBe(12);
  ui.tap(245, buttons[0].y);
  expect(ui.callbacks.onResume).toHaveBeenCalledOnce();
});

it('makes all settings controls at least 64x64 and the complete reset pill actionable', () => {
  const ui = setup();
  ui.settings.open();
  const controls = ui.items.filter(i => i.interactive && i.kind !== 'rectangle');
  for (const control of controls) {
    expect(control.width).toBeGreaterThanOrEqual(64);
    expect(control.height).toBeGreaterThanOrEqual(64);
  }
  const label = ui.items.find(i => i.text?.includes(t('setting_danger_reset')))!;
  ui.tap(248, label.y);
  expect(ui.items.some(i => i.text === t('reset_confirm_message'))).toBe(true);
  expect(ui.root().destroyed).toBe(false);
});

it('toggles from the label-side of a settings row and opens the language picker from the language button', () => {
  const ui = setup();
  ui.settings.open();
  const music = ui.items.find(i => i.text === t('setting_music'))!;
  ui.tap(-250, music.y);
  expect(ui.repo.read().progress.settings.music).toBe(false);
  const current = ui.items.find(i => i.text === 'English')!;
  ui.tap(current.x + 29, current.y);
  const row = ui.items.find(i => i.text === 'Português')!;
  const zone = ui.items.find(i => i.kind === 'zone' && i.interactive && i.y === row.y)!;
  zone.handlers.get('pointerdown')!();
  expect(getLocale()).toBe('pt-BR');
});

it('blocks underlying settings during confirmation and supports pill-edge Cancel/Delete taps', () => {
  const ui = setup();
  ui.settings.open();
  const danger = ui.items.find(i => i.text?.includes(t('setting_danger_reset')))!;
  ui.tap(0, danger.y);
  for (const control of ui.items.filter(i => i.interactive && i.kind !== 'rectangle')) {
    expect(control.width).toBeGreaterThanOrEqual(64);
    expect(control.height).toBeGreaterThanOrEqual(64);
  }
  ui.tap(-285, 0);
  ui.send('pointerdown', -285, 0);
  ui.send('pointerup', -340, 0);
  expect(ui.items.filter(i => i.kind === 'container').at(-1)?.destroyed).toBe(false);
  const music = ui.items.find(i => i.text === t('setting_music'))!;
  ui.tap(-250, music.y);
  expect(ui.repo.read().progress.settings.music).toBe(true);
  expect(ui.root().destroyed).toBe(false);
  const cancel = ui.items.find(i => i.text === t('btn_cancel'))!;
  ui.tap(cancel.x - 95, cancel.y);
  expect(ui.root().destroyed).toBe(false);
  expect(ui.restart).not.toHaveBeenCalled();
  ui.repo.setMusic(false);
  ui.tap(0, danger.y);
  const del = ui.items.filter(i => i.text === t('btn_confirm_delete')).at(-1)!;
  ui.tap(del.x + 95, del.y);
  expect(ui.repo.read().progress.settings.music).toBe(true);
  expect(ui.restart).toHaveBeenCalledOnce();
});

it('keeps Reset directly below the last row when haptics are unavailable', () => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  const ui = setup();
  ui.settings.open();
  expect(ui.items.some(i => i.text === t('setting_haptics'))).toBe(false);
  const sfx = ui.items.find(i => i.text === t('setting_sfx'))!;
  const privacy = ui.items.find(i => i.text === t('setting_privacy_row'))!;
  const danger = ui.items.find(i => i.text?.includes(t('setting_danger_reset')))!;
  expect(privacy.y - sfx.y).toBe(84);
  expect(danger.y - privacy.y).toBe(84);
});

describe('Privacy row in Settings', () => {
  it('always shows, sits below the last toggle and opens the privacy dialog', () => {
    const ui = setup({ ...NO_ADS, privacyOptionsRequired: () => false });
    ui.settings.open();
    const haptics = ui.items.find(i => i.text === t('setting_haptics'))!;
    const privacy = ui.items.find(i => i.text === t('setting_privacy_row'))!;
    const danger = ui.items.find(i => i.text?.includes(t('setting_danger_reset')))!;
    expect(privacy.y - haptics.y).toBe(84);
    expect(danger.y - privacy.y).toBe(84);
    ui.tap(-250, privacy.y);
    expect(ui.items.some(i => i.text === t('privacy_title'))).toBe(true);
  });
});

describe('hint dialog (rewarded ad opt-in)', () => {
  it('starts the ad only after the player taps Watch', () => {
    const ui = setup();
    ui.hintDialog.open();
    expect(ui.hintCallbacks.onWatch).not.toHaveBeenCalled();
    ui.tap(0, 89);
    expect(ui.hintCallbacks.onWatch).toHaveBeenCalledOnce();
    expect(ui.hintDialog.isOpen()).toBe(true);
  });

  it('closes on Cancel without starting an ad', () => {
    const ui = setup();
    ui.hintDialog.open();
    ui.tap(0, 177);
    expect(ui.hintCallbacks.onCancel).toHaveBeenCalledOnce();
    expect(ui.hintCallbacks.onWatch).not.toHaveBeenCalled();
    expect(ui.hintDialog.isOpen()).toBe(false);
  });

  it('keeps the dialog open and says so when no ad is available', () => {
    const ui = setup();
    ui.hintDialog.open();
    ui.hintDialog.showNoAd();
    expect(ui.items.some(i => i.text === t('hint_no_ad'))).toBe(true);
    expect(ui.hintDialog.isOpen()).toBe(true);
  });

  it('offers full-size touch targets', () => {
    const ui = setup();
    ui.hintDialog.open();
    for (const control of ui.items.filter(i => i.interactive && i.kind !== 'rectangle')) {
      expect(control.width).toBeGreaterThanOrEqual(64);
      expect(control.height).toBeGreaterThanOrEqual(64);
    }
  });
});
