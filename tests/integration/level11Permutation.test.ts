import { describe, expect, it } from 'vitest';
import { loadLevel } from '../../src/content/catalog.ts';
import { expandEquivalentAnchors } from '../../src/domain/pieceEquivalence.ts';
import { applyCommand, createPuzzle } from '../../src/domain/session.ts';

describe('Level 1-1 permutation e2e', () => {
  const rawLevel = loadLevel('1-1', 'campaign');
  const level = expandEquivalentAnchors(rawLevel);

  it('solves 1-1 via canonical placement (D1 at 16,56; D2 at 64,56)', () => {
    let state = createPuzzle(level);
    const t1 = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 16, y: 56 });
    expect(t1.outcome).toBe('snapped');
    state = t1.state;

    const t2 = applyCommand(level, state, { type: 'drop', pieceId: 'D2', x: 64, y: 56 });
    expect(t2.outcome).toBe('won');
    expect(t2.becameWon).toBe(true);
  });

  it('solves 1-1 via permuted placement (D2 at 16,56; D1 at 64,56)', () => {
    let state = createPuzzle(level);
    // Drag D2 to left anchor
    const t1 = applyCommand(level, state, { type: 'drop', pieceId: 'D2', x: 16, y: 56 });
    expect(t1.outcome).toBe('snapped');
    state = t1.state;

    // Drag D1 to right anchor
    const t2 = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 64, y: 56 });
    expect(t2.outcome).toBe('won');
    expect(t2.becameWon).toBe(true);
  });
});
