import { describe, expect, it } from 'vitest';
import { computeDragParityLayers } from '../src/presentation/board/dragParity.ts';
import type { Pt } from '../src/presentation/board/polygonClip.ts';

function makeSquare(x: number, y: number, size: number): Pt[] {
  return [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
}

describe('computeDragParityLayers', () => {
  it('returns empty array when dragPolygon is null, undefined, or degenerate', () => {
    const placed = [makeSquare(0, 0, 40)];
    expect(computeDragParityLayers(placed, null)).toEqual([]);
    expect(computeDragParityLayers(placed, undefined)).toEqual([]);
    expect(computeDragParityLayers(placed, [{ x: 0, y: 0 }, { x: 10, y: 10 }])).toEqual([]);
  });

  it('returns empty array when boardPolygons is empty', () => {
    const drag = makeSquare(10, 10, 40);
    expect(computeDragParityLayers([], drag)).toEqual([]);
  });

  it('returns empty array when drag polygon does not intersect any board piece', () => {
    const placed = [makeSquare(0, 0, 40)];
    const drag = makeSquare(100, 100, 40);
    expect(computeDragParityLayers(placed, drag)).toEqual([]);
  });

  it('isolates placed-placed overlaps when drag is disjoint', () => {
    // Two placed pieces overlapping each other at (0, 0)-(30, 30)
    const p1 = makeSquare(0, 0, 30);
    const p2 = makeSquare(10, 10, 30);
    // Drag is far away at (200, 200)
    const drag = makeSquare(200, 200, 40);

    // MUST NOT return P1 ∩ P2 overlap!
    expect(computeDragParityLayers([p1, p2], drag)).toEqual([]);
  });

  it('produces even hollow layer (filled: false, depth: 2) when drag overlaps one board piece', () => {
    const placed = [makeSquare(0, 0, 40)];
    const drag = makeSquare(20, 20, 40);

    const layers = computeDragParityLayers(placed, drag);
    expect(layers.length).toBe(1);
    expect(layers[0].depth).toBe(2);
    expect(layers[0].filled).toBe(false);
  });

  it('produces odd revival layer (filled: true, depth: 3) when drag overlaps an intersection of two board pieces', () => {
    // Two placed squares overlapping in (10, 10)-(30, 30)
    const p1 = makeSquare(0, 0, 30);
    const p2 = makeSquare(10, 10, 30);
    // Drag square covering the overlap region at (15, 15)-(25, 25)
    const drag = makeSquare(15, 15, 10);

    const layers = computeDragParityLayers([p1, p2], drag);
    // Depth 3 intersection must have filled: true (odd parity)
    const oddRevival = layers.find((l) => l.depth === 3);
    expect(oddRevival).toBeDefined();
    expect(oddRevival?.filled).toBe(true);
  });

  it('handles degeneracy: identical outlines cleanly without NaN or infinite loop', () => {
    const p1 = makeSquare(20, 20, 40);
    const drag = makeSquare(20, 20, 40);

    const layers = computeDragParityLayers([p1], drag);
    expect(layers.length).toBe(1);
    expect(layers[0].depth).toBe(2);
    expect(layers[0].filled).toBe(false);
  });

  it('handles degeneracy: shared edges return empty (area is zero)', () => {
    const p1 = makeSquare(0, 0, 40);
    // Touching exactly on right edge (x = 40)
    const drag = makeSquare(40, 0, 40);

    expect(computeDragParityLayers([p1], drag)).toEqual([]);
  });

  it('handles degeneracy: shared corner returns empty (area is zero)', () => {
    const p1 = makeSquare(0, 0, 40);
    // Touching exactly at corner (40, 40)
    const drag = makeSquare(40, 40, 40);

    expect(computeDragParityLayers([p1], drag)).toEqual([]);
  });
});
