import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../src/domain/mask.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/domain/mask.ts')>();
  return { ...actual, evaluate: vi.fn(actual.evaluate) };
});

import { evaluate } from '../src/domain/mask.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import type { StoragePort } from '../src/application/progressPort.ts';
import { PlayController } from '../src/application/playController.ts';
import { computeLayout, gridToCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';

const layout = computeLayout(720, 1280);
const level = loadLevel('1-1', 'harness');
const storage = (): StoragePort => {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};
const calls = () => vi.mocked(evaluate).mock.calls.length;

describe('PlayController không tính lại mask thừa', () => {
  beforeEach(() => {
    vi.mocked(evaluate).mockClear();
  });

  test('getSnapshot đọc mask đã cache', () => {
    const controller = new PlayController(level, createProgressRepository(storage(), campaignManifest, 'oracle-v1'));
    vi.mocked(evaluate).mockClear();
    controller.getSnapshot();
    controller.getSnapshot();
    controller.getSnapshot();
    expect(calls()).toBe(0);
  });

  test('kéo không gọi evaluate, kể cả qua nhiều ô', () => {
    const controller = new PlayController(level, createProgressRepository(storage(), campaignManifest, 'oracle-v1'));
    const d1 = level.pieces.find((p) => p.id === 'D1')!;
    const hit = pieceHitbox(d1, { kind: 'tray', turns: 0 }, layout, 0, 2);
    vi.mocked(evaluate).mockClear();
    controller.onPointerDown(hit.x + hit.width / 2, hit.y + hit.height / 2, layout);
    for (const [x, y] of [[40, 80], [40.4, 80.2], [52, 90], [60, 100]]) {
      const p = gridToCanvas(x, y, layout);
      controller.onPointerMove(p.x, p.y, layout);
    }
    controller.getSnapshot();
    expect(calls()).toBe(0);
  });

  test('thả mảnh cập nhật mask đã cache đúng kết quả mới', () => {
    const controller = new PlayController(level, createProgressRepository(storage(), campaignManifest, 'oracle-v1'));
    const d1 = level.pieces.find((p) => p.id === 'D1')!;
    const hit = pieceHitbox(d1, { kind: 'tray', turns: 0 }, layout, 0, 2);
    controller.onPointerDown(hit.x + hit.width / 2, hit.y + hit.height / 2, layout);
    const anchor = gridToCanvas(40, 80, layout);
    const transition = controller.onPointerUp(anchor.x, anchor.y, layout)!;
    expect(controller.getSnapshot().committedMask).toEqual(transition.mask);
    controller.onReset();
    expect(controller.getSnapshot().committedMask.some(Boolean)).toBe(false);
  });
});
