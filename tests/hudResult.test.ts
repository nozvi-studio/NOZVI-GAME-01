import { beforeEach, expect, test, vi } from 'vitest';
import { Hud } from '../src/presentation/hud/Hud.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { setLocale } from '../src/presentation/i18n.ts';
import { createFakeScene } from './helpers/fakeScene.ts';
import { drawJewel } from '../src/presentation/board/JewelShape.ts';
import { isReducedMotion } from '../src/presentation/transitions/motion.ts';

vi.mock('phaser', () => ({ default: { Math: { DegToRad: (v: number) => v * Math.PI / 180 } } }));
vi.mock('../src/presentation/sky/starTexture.ts', () => ({ starTexture: () => 'star' }));
vi.mock('../src/presentation/audio/uiCues.ts', () => ({ playUiCue: () => {} }));
vi.mock('../src/presentation/board/JewelShape.ts', () => ({ drawJewel: vi.fn() }));
vi.mock('../src/presentation/transitions/motion.ts', async (original) => ({
  ...await original<object>(), isReducedMotion: vi.fn(() => true),
}));

beforeEach(() => {
  setLocale('en-US');
  vi.mocked(isReducedMotion).mockReturnValue(true);
});

function setup(levelId = '1-3') {
  const { scene, calls, objects } = createFakeScene();
  const container = scene.add.container;
  scene.add.container = ((x = 0, y = 0) => {
    const obj = container(x, y);
    obj.x = x;
    obj.y = y;
    return obj;
  }) as typeof scene.add.container;
  scene.add.text = ((x: number, y: number, text: string) => {
    const obj = scene.add.container(x, y) as unknown as Record<string, unknown>;
    Object.assign(obj, { text, x, y, width: text.length * 12, height: 28 });
    obj.setText = (value: string) => { obj.text = value; obj.width = value.length * 12; return obj; };
    obj.setX = (value: number) => { obj.x = value; return obj; };
    return obj;
  }) as unknown as typeof scene.add.text;
  scene.add.zone = scene.add.container as unknown as typeof scene.add.zone;
  scene.add.rectangle = scene.add.container as unknown as typeof scene.add.rectangle;
  scene.tweens = { killTweensOf: vi.fn(), add: vi.fn() } as unknown as typeof scene.tweens;
  const callbacks = {
    onMenu: vi.fn(), onReset: vi.fn(), onRotate: vi.fn(), onToggleTarget: vi.fn(),
    onNextLevel: vi.fn(), onLevelSelect: vi.fn(),
  };
  const hud = new Hud(scene, '', callbacks, levelId, computeLayout(720, 1280));
  return { hud, callbacks, calls, objects };
}

test('campaign result hides the fact and shows time and saved best', () => {
  const { hud, objects } = setup();
  hud.setResult({ stars: 2, timeText: '0:12', best: { text: '0:09', highlight: false } });
  hud.showWinModal('A cosmic fact');
  expect(objects.some(o => o.text === 'A cosmic fact' && o.visible)).toBe(false);
  expect(objects.some(o => o.text === '0:12' && o.visible)).toBe(true);
  expect(objects.some(o => o.text === '0:09' && o.visible)).toBe(true);
  expect(objects.some(o => o.text === 'Replay' && o.visible)).toBe(true);
});

test('first clear hides Best; no-result mode preserves its fact', () => {
  const { hud, objects } = setup();
  hud.setResult({ stars: 0, timeText: '1:00', best: null });
  hud.showWinModal('A cosmic fact');
  expect(objects.find(o => o.text === 'Best')?.visible).toBe(false);
  hud.setResult(null);
  hud.showWinModal('A cosmic fact');
  expect(objects.some(o => o.text === 'A cosmic fact' && o.visible)).toBe(true);
  expect(objects.find(o => o.text === 'Time')?.visible).toBe(false);
});

test.each(['onLevelSelect', 'onNextLevel', 'onReset'] as const)('result action invokes %s', (action) => {
  const { hud, callbacks, calls } = setup();
  hud.setResult({ stars: 3, timeText: '0:02', best: null });
  hud.showWinModal();
  const handlers = calls.filter(c => c.method === 'on' && c.args[0] === 'pointerup');
  const index = ['onLevelSelect', 'onNextLevel', 'onReset'].indexOf(action);
  (handlers[index].args[1] as () => void)();
  expect(callbacks[action]).toHaveBeenCalledOnce();
});

test.each(['1-3', '3-1'])('drawn counter and pop animations stay inside the available span on %s', (levelId) => {
  const { hud, calls } = setup(levelId);
  vi.mocked(isReducedMotion).mockReturnValue(false);
  const right = levelId === '3-1' ? 575.2 : 696;
  for (const total of [2, 7, 10]) {
    vi.mocked(drawJewel).mockClear();
    const start = calls.length;
    hud.update({
      levelId, phase: 'playing', showTarget: true, matchedCount: 0, totalPieces: total,
      canRotate: false, selectedPieceId: null, dragPreviewMask: null, snapCandidateId: null,
      dragInfo: null, committedMask: new Uint8Array(0), timer: null,
    });
    const counterCalls = calls.slice(start);
    const face = counterCalls.find(c => c.method === 'fillRoundedRect')!;
    const width = face.args[2] as number;
    const center = counterCalls.find(c => c.kind === 'container' && c.method === 'setX')!.args[0] as number;
    expect(center - width / 2).toBeGreaterThanOrEqual(144.8 - 1e-8);
    expect(center + width / 2).toBeLessThanOrEqual(right + 1e-8);
    const jewels = vi.mocked(drawJewel).mock.calls.map(c => c[1]);
    const popStart = calls.length;
    hud.popCounterIcon(0);
    if (jewels.length) {
      expect(jewels).toHaveLength(total);
      expect(vi.mocked(drawJewel).mock.calls.at(-1)?.[1].radius).toBe(jewels[0].radius);
      expect(calls.slice(popStart).find(c => c.method === 'setPosition')?.args).toEqual([jewels[0].cx, 0]);
    } else {
      expect(calls.slice(popStart)).toEqual([]);
    }
  }
});
