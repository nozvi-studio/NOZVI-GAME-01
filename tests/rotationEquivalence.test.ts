import { describe, expect, test } from 'vitest';
import { anchorLevel } from './fixtures/anchorLevels.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { turnedCells } from '../src/domain/geometry.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';
import { arePiecesEquivalent, expandEquivalentAnchors } from '../src/domain/pieceEquivalence.ts';
import { shapeCells, effectiveOrientation } from '../src/domain/shapes.ts';
import type { ShapeKind, Orientation, Turns } from '../src/domain/model.ts';

const key = (cells: readonly (readonly [number, number])[]) => cells.map(([x, y]) => `${x},${y}`).sort().join(';');

describe('Tư thế giống hình thì cùng ô (turnedCells)', () => {
  const cases: Array<[ShapeKind, Orientation, number]> = [
    ['parallelogram', 0, 48], ['parallelogram', 1, 48], ['parallelogram', 2, 48], ['parallelogram', 3, 48],
    ['triangle', 0, 32], ['triangle', 1, 32], ['triangle', 4, 32], ['triangle', 7, 32],
    ['diamond', 0, 32], ['square', 0, 32], ['circle', 0, 32],
  ];

  test.each(cases)('%s hướng %i: ô sau khi xoay = ô chuẩn của hướng hiệu dụng', (kind, orientation, size) => {
    const piece = { shapeKind: kind, orientation, frameSize: size, cells: shapeCells(kind, orientation, size) };
    for (const turns of [0, 1, 2, 3] as Turns[]) {
      const expected = shapeCells(kind, effectiveOrientation(kind, orientation, turns), size);
      expect(key(turnedCells(piece, turns))).toBe(key(expected));
    }
  });

  test('bình hành xoay 1 nấc và 3 nấc cho đúng cùng một tập ô', () => {
    const cells = shapeCells('parallelogram', 0, 48);
    const piece = { shapeKind: 'parallelogram' as const, orientation: 0 as Orientation, frameSize: 48, cells };
    expect(key(turnedCells(piece, 1))).toBe(key(turnedCells(piece, 3)));
  });

  test('mảnh không có shapeKind (literal test) vẫn xoay theo ô như cũ', () => {
    expect(turnedCells({ frameSize: 2, cells: [[0, 0]] }, 1)).toEqual([[1, 0]]);
  });
});

describe('3-2: khớp hình là thắng, kể cả xoay theo chiều khác hoặc hoán vị mảnh', () => {
  test('bình hành xoay 3 nấc (cùng hình với 1 nấc) vẫn thắng', () => {
    const level = loadLevel('3-2', 'harness');
    let state = createPuzzle(level);
    let outcome = '';
    for (const t of level.targetPlacements ?? []) {
      const turns = t.pieceId === 'P1' ? 3 : t.turns;
      for (let i = 0; i < turns; i++) state = applyCommand(level, state, { type: 'rotate', pieceId: t.pieceId }).state;
      const dropped = applyCommand(level, state, { type: 'drop', pieceId: t.pieceId, x: t.x, y: t.y });
      state = dropped.state;
      outcome = dropped.outcome;
    }
    expect(outcome).toBe('won');
  });

  test('hai tam giác giống nhau cùng hướng khay nên đổi chỗ được: T1 hít vào neo của T2 và ngược lại', () => {
    // Anchor-mode copy of 3-2 (frozen); the live 3-2 is free placement
    const level = anchorLevel('3-2');
    const [t1, t2] = [level.pieces.find((p) => p.id === 'T1')!, level.pieces.find((p) => p.id === 'T2')!];
    expect(arePiecesEquivalent(t1, t2)).toBe(true);
    const expanded = expandEquivalentAnchors(level);
    const a1 = expanded.pieces.find((p) => p.id === 'T1')!.anchors;
    const a2 = expanded.pieces.find((p) => p.id === 'T2')!.anchors;
    expect(a1.map((a) => `${a.x},${a.y}`).sort()).toEqual(a2.map((a) => `${a.x},${a.y}`).sort());

    let state = createPuzzle(expanded);
    let outcome = '';
    const place = (pieceId: string, turns: number, fromPiece: string) => {
      const target = (level.targetPlacements ?? []).find((p) => p.pieceId === fromPiece)!;
      for (let i = 0; i < turns; i++) state = applyCommand(expanded, state, { type: 'rotate', pieceId }).state;
      const dropped = applyCommand(expanded, state, { type: 'drop', pieceId, x: target.x, y: target.y });
      state = dropped.state;
      outcome = dropped.outcome;
    };
    place('P1', 1, 'P1');
    place('S1', 0, 'S1');
    // T1 vào chỗ của T2 (cần 3 nấc), T2 vào chỗ của T1 (cần 1 nấc)
    place('T1', 3, 'T2');
    place('T2', 1, 'T1');
    expect(outcome).toBe('won');
  });
});
