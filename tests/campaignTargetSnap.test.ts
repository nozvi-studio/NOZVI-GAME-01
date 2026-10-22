import { describe, expect, test } from 'vitest';
import { CAMPAIGN_TARGET_SNAP_CHAPTERS, loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { freeSnapOrigin, TARGET_SNAP_RADIUS_SQ } from '../src/domain/freePlacement.ts';
import type { Turns } from '../src/domain/model.ts';

const approved = campaignManifest.filter((e) => e.status === 'approved').map((e) => e.id);

describe('campaign target snap', () => {
  test('chapters 1-3 opt in, in campaign and harness mode', () => {
    expect(CAMPAIGN_TARGET_SNAP_CHAPTERS).toEqual([1, 2, 3]);
    for (const mode of ['campaign', 'harness'] as const) {
      for (const id of ['1-3', '2-5', '3-8']) expect(loadLevel(id, mode).targetSnapRadiusSq, id).toBe(TARGET_SNAP_RADIUS_SQ);
    }
  });

  test('a drop a few cells off the answer lands on it in every approved level', () => {
    expect(approved.length).toBeGreaterThanOrEqual(46);
    for (const id of approved) {
      const level = loadLevel(id, 'campaign');
      for (const target of level.targetPlacements ?? []) {
        const piece = level.pieces.find((p) => p.id === target.pieceId)!;
        expect(freeSnapOrigin(level, piece, target.turns, target.x + 4, target.y - 4), `${id} ${piece.id}`).toEqual({
          x: target.x,
          y: target.y,
        });
      }
    }
  });

  test('chapter 3: a drop at the wrong turns does not snap onto the answer', () => {
    const level = loadLevel('3-1', 'campaign');
    const target = level.targetPlacements![0];
    const piece = level.pieces.find((p) => p.id === target.pieceId)!;
    const wrong = ((target.turns + 1) % 4) as Turns;
    expect(freeSnapOrigin(level, piece, wrong, target.x + 4, target.y - 4)).not.toEqual({ x: target.x, y: target.y });
  });
});
