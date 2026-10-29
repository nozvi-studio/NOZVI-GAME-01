import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { fitsBoard, turnedCells } from '../src/domain/geometry.ts';
import { applyHint } from '../src/domain/hintPlacement.ts';
import type { Level, PuzzleState } from '../src/domain/model.ts';
import { expandEquivalentAnchors } from '../src/domain/pieceEquivalence.ts';
import { createPuzzle } from '../src/domain/session.ts';
import { matchedPieceCount } from '../src/domain/targetMatch.ts';

const levels: Level[] = campaignManifest
  .filter((m) => m.status === 'approved')
  .map((m) => expandEquivalentAnchors(loadLevel(m.id, 'campaign')));

/** Apply hints until the level is won; returns how many it took. */
function hintsToWin(level: Level, start: PuzzleState): number {
  let state = start;
  for (let step = 1; step <= level.pieces.length; step++) {
    const before = matchedPieceCount(level, state);
    const hint = applyHint(level, state);
    expect(hint, `${level.id} step ${step}`).not.toBeNull();
    state = hint!.transition.state;
    if (state.phase === 'won') return step;
    expect(matchedPieceCount(level, state), `${level.id} step ${step}`).toBeGreaterThan(before);
  }
  throw new Error(`${level.id}: not won after ${level.pieces.length} hints`);
}

describe('applyHint', () => {
  test('there are campaign levels to check', () => {
    expect(levels.length).toBeGreaterThan(0);
  });

  test.each(levels.map((l) => [l.id, l] as const))('%s: hints from an empty board win within one hint per piece', (_id, level) => {
    expect(hintsToWin(level, createPuzzle(level))).toBeLessThanOrEqual(level.pieces.length);
  });

  test.each(levels.filter((l) => l.pieces.length >= 2).map((l) => [l.id, l] as const))(
    '%s: a wrong piece sitting on a target is cleared, and hints still win',
    (_id, level) => {
      const targets = level.targetPlacements!;
      const [stray, owner] = [level.pieces[0], targets[1]];
      if (!fitsBoard(turnedCells(stray, 0), owner.x, owner.y)) return;
      const pieces = {
        ...createPuzzle(level).pieces,
        [stray.id]: { kind: 'placed' as const, x: owner.x, y: owner.y, turns: 0 as const },
      };
      // Anchor levels cannot hold a free piece: the same hint check applies with a loose one.
      const start: PuzzleState = {
        levelId: level.id,
        phase: 'playing',
        pieces: level.placement === 'free' ? pieces : { ...pieces, [stray.id]: { kind: 'temporary', x: owner.x, y: owner.y, turns: 0 } },
      };
      expect(hintsToWin(level, start)).toBeLessThanOrEqual(level.pieces.length);
    }
  );

  test('a won level gets no hint', () => {
    const level = levels[0];
    let state = createPuzzle(level);
    for (let i = 0; i < level.pieces.length; i++) state = applyHint(level, state)!.transition.state;
    expect(state.phase).toBe('won');
    expect(applyHint(level, state)).toBeNull();
  });

  test('the hinted piece lands on its target and the board counts it', () => {
    const level = levels.find((l) => l.pieces.length >= 3) ?? levels[0];
    const hint = applyHint(level, createPuzzle(level))!;
    expect(hint.transition.accepted).toBe(true);
    expect(matchedPieceCount(level, hint.transition.state)).toBe(hint.transition.becameWon ? level.pieces.length : 1);
  });
});
