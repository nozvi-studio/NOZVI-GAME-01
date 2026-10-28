import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import { PlayController } from '../src/application/playController.ts';
import { computeLayout, pieceHitbox } from '../src/presentation/board/layout.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

function storage(): StoragePort {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v) };
}

const layout = computeLayout(720, 1280);
const level = loadLevel('1-1', 'harness');

function setup() {
  const repo = createProgressRepository(storage(), campaignManifest, 'oracle-v2');
  return { repo, controller: new PlayController(level, repo, true) };
}

describe('PlayController.onHint', () => {
  test('puts one piece on its target and counts it as matched', () => {
    const { controller } = setup();
    const hint = controller.onHint()!;
    expect(hint).not.toBeNull();
    expect(controller.getSnapshot().matchedCount).toBe(1);
    expect(controller.getPuzzleState().pieces[hint.pieceId].kind).not.toBe('tray');
  });

  test('one hint per piece wins the level and records the result', () => {
    const { controller, repo } = setup();
    for (let i = 0; i < level.pieces.length; i++) controller.onHint();
    expect(controller.getSnapshot().phase).toBe('won');
    expect(controller.getResult()).not.toBeNull();
    expect(repo.read().progress.completed).toContain('1-1');
    expect(controller.onHint()).toBeNull();
  });

  test('is refused while a piece is in hand', () => {
    const { controller } = setup();
    const piece = level.pieces[0];
    const box = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, 0);
    expect(controller.onPointerDown(box.x + box.width / 2, box.y + box.height / 2, layout)).toBe(true);
    expect(controller.onHint()).toBeNull();
  });
});
