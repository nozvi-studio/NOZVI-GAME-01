import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import type { Level, PieceState, PuzzleState } from '../src/domain/model.ts';
import { isOnTarget, matchedPieceCount } from '../src/domain/targetMatch.ts';

const level = loadLevel('1-1', 'harness');
const targets = level.targetPlacements!;
const state = (pieces: Record<string, PieceState>, phase: PuzzleState['phase'] = 'playing'): PuzzleState =>
  ({ levelId: level.id, phase, pieces });
const tray = { kind: 'tray', turns: 0 } as const;
const trays = Object.fromEntries(level.pieces.map((p) => [p.id, tray]));
const placedAt = (t: { x: number; y: number; turns: 0 | 1 | 2 | 3 }): PieceState => ({ kind: 'placed', x: t.x, y: t.y, turns: t.turns });

describe('targetMatch', () => {
  test('a level has sample placements to compare against', () => {
    expect(targets.length).toBe(level.pieces.length);
  });

  test('placement on the sample solution is on target, a nearby grid point is not', () => {
    const t = targets[0];
    expect(isOnTarget(level, t)).toBe(true);
    expect(isOnTarget(level, { ...t, x: t.x + 8 })).toBe(false);
    expect(isOnTarget(level, { ...t, turns: ((t.turns + 1) % 4) as 0 | 1 | 2 | 3 })).toBe(false);
  });

  test('matched count ignores pieces that merely rest on the board', () => {
    expect(matchedPieceCount(level, state(trays))).toBe(0);
    const [first] = targets;
    const wrong = { ...first, x: first.x + 8 };
    expect(matchedPieceCount(level, state({ ...trays, [first.pieceId]: placedAt(wrong) }))).toBe(0);
    expect(matchedPieceCount(level, state({ ...trays, [first.pieceId]: placedAt(first) }))).toBe(1);
  });

  test('a piece on a target it does not own does not count twice', () => {
    const pieces = level.pieces.map((p) => p.id);
    const same = level.pieces[0];
    const twin = level.pieces.find((p) => p.id !== same.id && p.shapeKind === same.shapeKind && p.frameSize === same.frameSize);
    if (!twin) return; // 1-1 has two identical pieces; if that changes, this case has nothing to say
    const spot = targets.find((t) => t.pieceId === same.id)!;
    const both = state({ ...trays, [same.id]: placedAt(spot), [twin.id]: placedAt(spot) });
    expect(matchedPieceCount(level, both)).toBe(1);
    expect(pieces.length).toBeGreaterThan(1);
  });

  test('a won level counts every piece, even when solved another way', () => {
    expect(matchedPieceCount(level, state(trays, 'won'))).toBe(level.pieces.length);
  });

  test('a level without sample placements matches nothing', () => {
    const bare: Level = { ...level, targetPlacements: undefined };
    expect(matchedPieceCount(bare, state({ ...trays, [targets[0].pieceId]: placedAt(targets[0]) }))).toBe(0);
  });
});
