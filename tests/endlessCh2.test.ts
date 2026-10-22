import { describe, expect, it } from 'vitest';
import { generateChapter2Level } from '../tools/experiments/endless-ch2/generator.ts';
import { validateLevel } from '../src/content/validate.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';

describe('Endless Chapter 2 Generator (Giao Thoa HSR)', () => {
  it('generates a valid Chapter 2 level with exactly 1 proven solution', () => {
    let gen = null;
    for (let s = 1; s <= 20 && !gen; s++) {
      gen = generateChapter2Level(s, 'test-ch2-001', 1);
    }
    expect(gen).not.toBeNull();
    if (!gen) return;

    expect(gen.source.chapter).toBe(2);
    expect(gen.source.rotationEnabled).toBe(false);
    expect(gen.result.ok).toBe(true);
    expect(gen.result.report.proven).toBe(true);
    expect(gen.result.report.solutionCount).toBe(1);
    expect(gen.result.report.fewerPieceSolutions).toBe(0);

    // Rule: pieces between 3 and 5
    expect(gen.stats.pieces).toBeGreaterThanOrEqual(3);
    expect(gen.stats.pieces).toBeLessThanOrEqual(5);

    // Rule: at most 2 3-layer spots
    expect(gen.stats.threeLayerSpots).toBeLessThanOrEqual(2);

    // Rule: every piece has at least 2 decoy anchors
    expect(gen.stats.minDecoysPerPiece).toBeGreaterThanOrEqual(2);
  });

  it('allows interchangeable placement of identical pieces without solver conflict', () => {
    // Seed 6 generates prophetic-eye with two identical 64x64 diamonds (D1, D2)
    const gen = generateChapter2Level(6, 'test-prophetic-eye', 1);
    expect(gen).not.toBeNull();
    if (!gen) return;

    const valRes = validateLevel(gen.result.doc);
    expect(valRes.ok).toBe(true);
    if (!valRes.ok) return;

    const level = valRes.level;
    const d1 = level.pieces.find((p) => p.id === 'D1')!;
    const d2 = level.pieces.find((p) => p.id === 'D2')!;
    const d3 = level.pieces.find((p) => p.id === 'D3')!;

    // Both D1 and D2 have anchors at both positions (16, 48) and (48, 48)
    expect(d1.anchors.some((a) => a.x === 16 && a.y === 48)).toBe(true);
    expect(d1.anchors.some((a) => a.x === 48 && a.y === 48)).toBe(true);
    expect(d2.anchors.some((a) => a.x === 16 && a.y === 48)).toBe(true);
    expect(d2.anchors.some((a) => a.x === 48 && a.y === 48)).toBe(true);

    // Permutation A: D1 at left (16, 48), D2 at right (48, 48), D3 at center
    let stateA = createPuzzle(level);
    stateA = applyCommand(level, stateA, { type: 'drop', pieceId: 'D1', x: 16, y: 48 }).state;
    stateA = applyCommand(level, stateA, { type: 'drop', pieceId: 'D2', x: 48, y: 48 }).state;
    const winA = applyCommand(level, stateA, { type: 'drop', pieceId: 'D3', x: 56, y: 72 });
    expect(winA.becameWon).toBe(true);
    expect(winA.state.phase).toBe('won');

    // Permutation B (swapped): D1 at right (48, 48), D2 at left (16, 48), D3 at center
    let stateB = createPuzzle(level);
    stateB = applyCommand(level, stateB, { type: 'drop', pieceId: 'D1', x: 48, y: 48 }).state;
    stateB = applyCommand(level, stateB, { type: 'drop', pieceId: 'D2', x: 16, y: 48 }).state;
    const winB = applyCommand(level, stateB, { type: 'drop', pieceId: 'D3', x: 56, y: 72 });
    expect(winB.becameWon).toBe(true);
    expect(winB.state.phase).toBe('won');
  });

  it('generates unique silhouettes across different seeds', () => {
    const set = new Set<string>();
    let count = 0;
    for (let s = 1; s <= 10; s++) {
      const gen = generateChapter2Level(s, `test-${s}`, s);
      if (gen) {
        set.add(gen.silhouetteKey);
        count++;
      }
    }
    expect(count).toBeGreaterThan(0);
    // All generated levels have distinct silhouettes
    expect(set.size).toBe(count);
  });
});
