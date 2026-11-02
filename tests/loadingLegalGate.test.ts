import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { LoadingScene } from '../src/presentation/scenes/LoadingScene.ts';
import { createPrivacyChoices, type PrivacyPurpose } from '../src/application/privacyChoices.ts';
import { LEGAL_VERSION } from '../src/presentation/legal/legalVersion.ts';
import { closeLegalAcceptance, isLegalAcceptanceOpen } from '../src/presentation/legal/legalAcceptance.ts';
import { isLegalDocumentOpen } from '../src/presentation/legal/legalViewer.ts';
import { dismissTopLegalOverlay } from '../src/presentation/legal/legalOverlay.ts';
import { director } from '../src/presentation/transitions/director.ts';
import { setMotionScale } from '../src/presentation/transitions/motion.ts';
import { t } from '../src/presentation/i18n.ts';
import { fakeScene } from './helpers/fakeScene.ts';
import { fakeDocument } from './helpers/fakeDocument.ts';

vi.mock('phaser', () => ({ default: {
  Scene: class {}, Core: { Events: { POST_RENDER: 'postrender' } },
  Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fadeout' } } },
} }));
vi.mock('../src/engine/core/viewport/designViewport.ts', () => ({
  applyDesignViewport: () => {}, designViewBounds: () => ({ width: 390, height: 844 }),
}));
vi.mock('../src/presentation/transitions/director.ts', () => ({ director: { boot: vi.fn() } }));

afterEach(() => { closeLegalAcceptance(); vi.unstubAllGlobals(); vi.clearAllMocks(); setMotionScale(1); });

async function setup(version?: string, reduced = true, offered: readonly PrivacyPurpose[] = []) {
  setMotionScale(reduced ? 0 : 1);
  const stored = new Map<string, string>();
  const choices = createPrivacyChoices({ getItem: k => stored.get(k) ?? null, setItem: (k, v) => { stored.set(k, v); } });
  if (version) choices.acceptLegal(version);
  const d = fakeDocument();
  vi.stubGlobal('document', d.doc);
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn());
  const ui = fakeScene({ privacy: { choices, offered } });
  const scene = new LoadingScene();
  const events = new EventEmitter();
  const gameEvents = new EventEmitter();
  const input = new EventEmitter();
  const camera = Object.assign(new EventEmitter(), { fadeIn: vi.fn(), fadeOut: vi.fn(() => camera.emit('fadeout')) });
  const context = { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} };
  const stop = vi.fn();
  const delayedCall = vi.fn((_ms: number, fn: () => void) => fn());
  const originalAdd = ui.scene.add;
  Object.assign(scene, ui.scene, {
    add: { ...originalAdd, circle: originalAdd.image, ellipse: originalAdd.image },
    events, input, game: { events: gameEvents }, cameras: { main: camera },
    textures: { exists: () => false, createCanvas: () => ({ context, refresh() {} }) },
    load: Object.assign(new EventEmitter(), { svg() {}, start() {}, isLoading: () => false }),
    scene: { isActive: () => true, stop }, time: { delayedCall },
  });
  scene.init({ prepareAudio: async () => {} });
  scene.create();
  gameEvents.emit('postrender');
  await Promise.resolve(); await Promise.resolve();
  const finish = () => scene.update(2000, 2000);
  const entry = () => ui.items.find(i => i.text === t('loading_tap_to_enter'));
  const tap = () => {
    const stopPropagation = vi.fn();
    entry()!.handlers.get('pointerdown')!({}, 0, 0, { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
  };
  return { scene, choices, stored, d, ui, events, input, camera, delayedCall, finish, entry, tap, stop };
}

it.each([undefined, '2025-01-01'])('waits for acceptance when stored version is %s and keeps animating', async version => {
  const s = await setup(version, false);
  s.scene.update(1000, 1000);
  expect(s.entry()).toBeUndefined();
  s.finish();
  expect(s.entry()?.interactive).toBe(true);
  expect(s.entry()?.style?.backgroundColor).toBe('#FFD54F');
  expect(director.boot).not.toHaveBeenCalled();
  const spin = (s.scene as unknown as { spinClock: number }).spinClock;
  s.scene.update(5000, 100);
  expect((s.scene as unknown as { spinClock: number }).spinClock).not.toBe(spin);
  expect(s.ui.items.filter(i => i.text === t('loading_tap_to_enter'))).toHaveLength(1);
  s.tap();
  expect(isLegalAcceptanceOpen()).toBe(true);
  s.d.byId('legal-acceptance-close').fire('click');
  expect(isLegalAcceptanceOpen()).toBe(false);
  s.scene.update(6000, 1000);
  expect(director.boot).not.toHaveBeenCalled();
  s.tap();
  expect(isLegalAcceptanceOpen()).toBe(true);
});

it.each([true, false])('accepts and exits through the existing boot path (reduced motion: %s)', async reduced => {
  const s = await setup(undefined, reduced, ['analytics', 'diagnostics', 'ads']);
  s.finish(); s.tap();
  s.d.byId('legal-accept').fire('click');
  expect(s.choices.acceptedLegalVersion()).toBe(LEGAL_VERSION);
  expect(s.choices.get()).toEqual({ analytics: true, diagnostics: true, ads: true });
  expect(s.stop).toHaveBeenCalledWith('LoadingScene');
  expect(director.boot).toHaveBeenCalledWith('MenuScene', {});
  expect(s.delayedCall).toHaveBeenCalledTimes(reduced ? 0 : 1);
  if (!reduced) expect(s.camera.fadeOut).toHaveBeenCalledWith(300, 14, 18, 64);
  s.scene.update(4000, 2000);
  expect(director.boot).toHaveBeenCalledOnce();
});

it('keeps previously stored optional choices and user ID unchanged on acceptance', async () => {
  const s = await setup();
  s.choices.set({ analytics: true, diagnostics: false, ads: true });
  const id = s.choices.userId();
  const changed = vi.fn(); s.choices.onChange(changed);
  s.finish(); s.tap(); s.d.byId('legal-accept').fire('click');
  expect(s.choices.get()).toEqual({ analytics: true, diagnostics: false, ads: true });
  expect(s.choices.userId()).toBe(id);
  expect(changed).toHaveBeenCalledWith({ analytics: true, diagnostics: false, ads: true });
});

it.each([
  { offered: [], expected: { analytics: false, diagnostics: false, ads: false } },
  { offered: ['analytics'], expected: { analytics: true, diagnostics: false, ads: false } },
  { offered: ['diagnostics'], expected: { analytics: false, diagnostics: true, ads: false } },
  { offered: ['ads'], expected: { analytics: false, diagnostics: false, ads: true } },
  { offered: ['analytics', 'diagnostics', 'ads'], expected: { analytics: true, diagnostics: true, ads: true } },
] as const)('accept enables exactly the offered purposes: $offered', async ({ offered, expected }) => {
  const s = await setup('2026-11-03', true, offered);
  const changed = vi.fn(() => {
    expect(s.choices.acceptedLegalVersion()).toBe('2026-11-03');
    expect(director.boot).not.toHaveBeenCalled();
  });
  s.choices.onChange(changed);
  s.finish(); s.tap();
  expect(s.d.byId('legal-notice').textContent.includes('Tapping Agree also turns on')).toBe(offered.length > 0);
  s.d.byId('legal-accept').fire('click');
  expect(s.choices.get()).toEqual(expected);
  expect(changed).toHaveBeenCalledOnce();
  const saved = createPrivacyChoices({ getItem: k => s.stored.get(k) ?? null, setItem: (k, v) => { s.stored.set(k, v); } });
  expect(saved.get()).toEqual(expected);
  expect(saved.acceptedLegalVersion()).toBe(LEGAL_VERSION);
  expect(director.boot).toHaveBeenCalledOnce();
});

it.each(['close', 'Escape', 'back'])('%s preserves all stored choices and legal version', async action => {
  const s = await setup('2025-01-01', true, ['analytics', 'diagnostics', 'ads']);
  s.choices.set({ analytics: true, diagnostics: false, ads: true });
  const before = [...s.stored];
  const changed = vi.fn(); s.choices.onChange(changed);
  s.finish(); s.tap();
  if (action === 'Escape') s.d.fake.key('Escape');
  else if (action === 'back') dismissTopLegalOverlay();
  else s.d.byId('legal-acceptance-close').fire('click');
  expect(isLegalAcceptanceOpen()).toBe(false);
  expect([...s.stored]).toEqual(before);
  expect(changed).not.toHaveBeenCalled();
  expect(director.boot).not.toHaveBeenCalled();
});

it('automatically leaves when the current legal version was accepted', async () => {
  const s = await setup(LEGAL_VERSION);
  s.finish();
  expect(director.boot).toHaveBeenCalledWith('MenuScene', {});
  expect(s.entry()).toBeUndefined();
  expect(isLegalAcceptanceOpen()).toBe(false);
});

it('Back closes the viewer then popup without leaving; shutdown cleans up overlays', async () => {
  const s = await setup();
  s.finish(); s.tap(); s.d.byId('legal-link-terms').fire('click');
  expect(dismissTopLegalOverlay()).toBe(true);
  expect(isLegalDocumentOpen()).toBe(false);
  expect(isLegalAcceptanceOpen()).toBe(true);
  expect(dismissTopLegalOverlay()).toBe(true);
  expect(isLegalAcceptanceOpen()).toBe(false);
  expect(director.boot).not.toHaveBeenCalled();
  s.tap(); s.d.byId('legal-link-privacy').fire('click');
  s.events.emit('shutdown');
  expect(isLegalDocumentOpen()).toBe(false);
  expect(isLegalAcceptanceOpen()).toBe(false);
  expect(s.input.listenerCount('pointerdown')).toBe(0);
});

it('keeps fact swapping outside the entry button and blocks it while a modal is open', async () => {
  const s = await setup();
  const fact = s.ui.items.find(i => i.style?.fontSize === '15px')!;
  const before = fact.text;
  s.finish(); s.input.emit('pointerdown');
  expect(fact.text).not.toBe(before);
  s.tap();
  const whileOpen = fact.text;
  s.input.emit('pointerdown');
  expect(fact.text).toBe(whileOpen);
});
