import { expect, it, vi } from 'vitest';
import { TargetBadge } from '../src/presentation/board/TargetBadge.ts';
import { computeLayout } from '../src/presentation/board/layout.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { createFakeScene, type FakeObject } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({ default: { Geom: {
  Point: class { constructor(public x: number, public y: number) {} },
  Circle: class { static Contains = () => true; constructor(public x: number, public y: number, public radius: number) {} },
} } }));

it('scales the silhouette, ring and hit area together and restores the responsive size after zoom', () => {
  const { scene, calls } = createFakeScene();
  scene.add.rectangle = scene.add.container as unknown as typeof scene.add.rectangle;
  const tweens: Array<{ targets: unknown; scaleX?: number; scaleY?: number; onComplete?: () => void }> = [];
  scene.tweens = { add: (config: typeof tweens[number]) => { tweens.push(config); } } as unknown as typeof scene.tweens;
  scene.time = { delayedCall: (_ms: number, callback: () => void) => callback() } as unknown as typeof scene.time;
  const badge = new TargetBadge(scene, computeLayout(720, 1640), loadLevel('1-1', 'campaign'));
  const container = badge.getContainer() as unknown as FakeObject;
  expect(calls.find(c => c.owner === container.__id && c.method === 'setScale')?.args).toEqual([1.55]);
  const children = calls.find(c => c.owner === container.__id && c.method === 'add')?.args[0] as FakeObject[];
  expect(children).toHaveLength(2);
  expect(calls.some(c => c.owner === children[0].__id && c.method === 'strokeCircle')).toBe(true);
  expect(calls.some(c => c.owner === children[1].__id && c.method === 'fillPoints')).toBe(true);
  expect(calls.find(c => c.owner === container.__id && c.method === 'setInteractive')?.args[0]).toMatchObject({ radius: 96 });
  const down = calls.find(c => c.owner === container.__id && c.method === 'on' && c.args[0] === 'pointerdown')!.args[1] as (pointer: object) => void;
  down({});
  const grow = tweens.find(t => t.targets === container)!;
  expect(grow.scaleX).toBeCloseTo(2.0925);
  expect(grow.scaleY).toBeCloseTo(2.0925);
  grow.onComplete?.();
  const restore = tweens.filter(t => t.targets === container).at(-1)!;
  expect(restore.scaleX).toBe(1.55);
  expect(restore.scaleY).toBe(1.55);
});
