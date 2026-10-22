import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';
import doc from '../src/content/levels/1-9.json' with { type: 'json' };

type Drop = [string, number, number];

/** The sample solution of the authored document: piece id and the grid corner it sits on. */
function sampleDrops(): Drop[] {
  return doc.sampleSolutions[0].map((step) => {
    const piece = doc.pieces.find((p) => p.id === step.pieceId)!;
    const anchor = piece.anchors.find((a) => a.id === step.anchorId)!;
    return [step.pieceId, anchor.x, anchor.y];
  });
}

/** 1-9 is free placement: a piece snaps to the nearest 8-cell grid corner, so a small miss still lands. */
function play(drops: Drop[]): boolean {
  const level = loadLevel('1-9', 'harness');
  let state = createPuzzle(level);
  for (const [pieceId, x, y] of drops) {
    // Drop 2 cells off the grid corner: the piece must snap to the nearest corner.
    state = applyCommand(level, state, { type: 'drop', pieceId, x: x + 2, y: y - 1 }).state;
  }
  return state.phase === 'won';
}

describe('1-9 free placement', () => {
  test('the sample solution wins, even dropped 2 cells off the grid corner', () => {
    expect(play(sampleDrops())).toBe(true);
  });

  test('a piece one grid step off its place does not win', () => {
    const drops = sampleDrops();
    drops[0] = [drops[0][0], drops[0][1] + 8, drops[0][2]];
    expect(play(drops)).toBe(false);
  });
});
