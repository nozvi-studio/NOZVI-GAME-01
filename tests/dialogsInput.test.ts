import type Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PauseDialog } from '../src/presentation/dialogs/PauseDialog.ts';
import { SettingsDialog } from '../src/presentation/dialogs/SettingsDialog.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import { getLocale, setLocale, t } from '../src/presentation/i18n.ts';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => true) } }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));

type Item = {
  kind: string; x: number; y: number; width: number; height: number;
  text?: string; style?: Record<string, unknown>; interactive: boolean; destroyed: boolean;
  children: Item[]; handlers: Map<string, (...args: any[]) => void>;
};

// Only the Phaser display/input boundary is faked; dialogs and persistence run unchanged.
function setup() {
  const items: Item[] = [];
  const make = (kind: string, x = 0, y = 0, width = 0, height = 0, text?: string, style?: Record<string, unknown>) => {
    const item: Item = { kind, x, y, width, height, text, style, interactive: false, destroyed: false, children: [], handlers: new Map() };
    const proxy = new Proxy(item, {
      get(target, key) {
        if (key in target) return target[key as keyof Item];
        return (...args: any[]) => {
          if (key === 'on') target.handlers.set(args[0], args[1]);
          if (key === 'add') target.children.push(...(Array.isArray(args[0]) ? args[0] : [args[0]]));
          if (key === 'setInteractive') target.interactive = true;
          if (key === 'disableInteractive') target.interactive = false;
          if (key === 'destroy') target.destroyed = true;
          if (key === 'setDisplaySize' || key === 'setSize') [target.width, target.height] = args;
          return proxy;
        };
      },
    });
    items.push(proxy);
    return proxy;
  };
  const restart = vi.fn();
  const scene = {
    scale: { width: 1080, height: 2460 },
    add: {
      container: (x: number, y: number) => make('container', x, y),
      rectangle: (x: number, y: number, w: number, h: number) => make('rectangle', x, y, w, h),
      zone: (x: number, y: number, w: number, h: number) => make('zone', x, y, w, h),
      image: (x: number, y: number) => make('image', x, y, 24, 24),
      graphics: () => make('graphics'),
      text: (x: number, y: number, text: string, style: Record<string, unknown>) => make('text', x, y, text.length * 12, 30, text, style),
    },
    tweens: { add: (config: { onComplete?: () => void }) => config.onComplete?.() },
    scene: { restart },
  } as unknown as Phaser.Scene;
  const storage = new Map<string, string>();
  const repo = createProgressRepository({ getItem: k => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v); } }, [], 'test');
  const onClose = vi.fn();
  const settings = new SettingsDialog(scene, repo, onClose);
  const callbacks = { onResume: vi.fn(), onRestart: vi.fn(), onLevelSelect: vi.fn() };
  const pause = new PauseDialog(scene, callbacks);
  const hit = (parent: Item, x: number, y: number): Item | undefined => {
    if (parent.destroyed) return;
    for (const child of [...parent.children].reverse()) {
      const found = hit(child, x - child.x, y - child.y);
      if (found) return found;
    }
    if (parent.interactive && Math.abs(x) <= parent.width / 2 && Math.abs(y) <= parent.height / 2) return parent;
  };
  const root = () => items.find(i => i.kind === 'container')!;
  const pointer = { id: 1 };
  const send = (event: string, x: number, y: number, id = 1) => {
    const item = hit(root(), x, y);
    item?.handlers.get(event)?.({ ...pointer, id }, 0, 0, { stopPropagation() {} });
  };
  const tap = (x: number, y: number) => { send('pointerdown', x, y); send('pointerup', x, y); };
  return { items, root, send, tap, settings, pause, callbacks, repo, restart, onClose };
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
  for (const [index, button] of buttons.entries()) {
    const zone = button.children.find(i => i.interactive)!;
    expect(zone.width).toBe(500);
    expect(zone.height).toBe(88);
    if (index) expect(button.y - buttons[index - 1].y - 88).toBe(24);
  }
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
