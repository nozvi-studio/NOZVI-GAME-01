import { describe, expect, test, vi } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import { PlayController } from '../src/application/playController.ts';
import { computeLayout, gridToCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

function storage(): StoragePort {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v) };
}

const layout = computeLayout(720, 1280);
const level = loadLevel('1-1', 'harness');

function setup(isCampaign = true) {
  const repo = createProgressRepository(storage(), campaignManifest, 'oracle-v2');
  return { repo, controller: new PlayController(level, repo, isCampaign) };
}

/** Press the tray piece `id` that sits in tray `slot` (D1 = 0, D2 = 1). */
function press(controller: PlayController, id: 'D1' | 'D2', slot: number): boolean {
  const piece = level.pieces.find((p) => p.id === id)!;
  const box = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, slot);
  return controller.onPointerDown(box.x + box.width / 2, box.y + box.height / 2, layout);
}

function dropAt(controller: PlayController, gx: number, gy: number) {
  const at = gridToCanvas(gx, gy, layout);
  controller.onPointerMove(at.x, at.y, layout);
  return controller.onPointerUp(at.x, at.y, layout);
}

/** The winning sequence of tests/playController.test.ts; `msBetween` of play time passes between the two moves. */
function solve(controller: PlayController, msBetween = 0): void {
  expect(press(controller, 'D1', 0)).toBe(true);
  dropAt(controller, 40, 80);
  for (let remaining = msBetween; remaining > 0; remaining -= 16) {
    controller.tickClock(Math.min(remaining, 16));
  }
  expect(press(controller, 'D2', 1)).toBe(true);
  expect(dropAt(controller, 88, 80)?.becameWon).toBe(true);
}

describe('PlayController time stars', () => {
  test('snapshot has no timer outside the campaign', () => {
    expect(setup(false).controller.getSnapshot().timer).toBeNull();
  });

  test('the clock waits for the first pointer-down on a piece', () => {
    const { controller } = setup();
    controller.tickClock(1000);
    expect(controller.getSnapshot().timer).toMatchObject({ elapsedMs: 0, active: false });
    press(controller, 'D1', 0);
    controller.tickClock(16);
    expect(controller.getSnapshot().timer).toMatchObject({ elapsedMs: 16, active: true, stars: 3 });
  });

  test('caps a hidden-tab delta at 250 ms', () => {
    const { controller } = setup();
    press(controller, 'D1', 0);
    controller.tickClock(30_000);
    expect(controller.getSnapshot().timer?.elapsedMs).toBe(250);
  });

  test('normal 16 ms frames accumulate exactly', () => {
    const { controller } = setup();
    press(controller, 'D1', 0);
    for (let frame = 0; frame < 100; frame++) controller.tickClock(16);
    expect(controller.getSnapshot().timer?.elapsedMs).toBe(1600);
  });

  test('reset puts the clock back to not started', () => {
    const { controller } = setup();
    press(controller, 'D1', 0);
    controller.tickClock(500);
    controller.onReset();
    expect(controller.getSnapshot().timer).toMatchObject({ elapsedMs: 0, active: false });
  });

  test('a fast win records 3 stars and stops the clock', () => {
    const { controller, repo } = setup();
    solve(controller, 100);
    const result = controller.getResult();
    expect(result?.stars).toBe(3);
    expect(result?.elapsedMs).toBe(100);
    expect(repo.read().progress.levels['1-1']).toEqual({ stars: 3, bestMs: 100 });
    controller.tickClock(5000);
    expect(controller.getSnapshot().timer?.elapsedMs).toBe(100);
  });

  test('a win after the bar is empty still completes with 0 stars', () => {
    const { controller, repo } = setup();
    solve(controller, 999_999);
    expect(controller.getResult()?.stars).toBe(0);
    expect(repo.read().progress.completed).toContain('1-1');
    expect(repo.read().progress.levels['1-1'].stars).toBe(0);
  });

  test('a campaign win exposes the previous record for the result card', () => {
    const { controller } = setup();
    solve(controller, 100);
    expect(controller.getResult()?.record.previous).toBeNull();
    expect(controller.getResult()?.record.improved).toBe(true);
  });

  test('a win records once; later presses and ticks change nothing', () => {
    const { controller, repo } = setup();
    const record = vi.spyOn(repo, 'recordResult');
    solve(controller, 100);
    expect(press(controller, 'D1', 0)).toBe(false);
    controller.tickClock(5000);
    expect(record).toHaveBeenCalledTimes(1);
    expect(repo.read().progress.levels['1-1']).toEqual({ stars: 3, bestMs: 100 });
  });

  test('outside the campaign nothing is recorded', () => {
    const { controller, repo } = setup(false);
    solve(controller);
    expect(controller.getResult()).toBeNull();
    expect(repo.read().progress.completed).toEqual([]);
    expect(repo.read().progress.levels).toEqual({});
  });
});
