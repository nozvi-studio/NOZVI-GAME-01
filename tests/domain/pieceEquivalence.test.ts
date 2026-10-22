import { describe, expect, it } from 'vitest';
import type { Level, Piece } from '../../src/domain/model.ts';
import { arePiecesEquivalent, expandEquivalentAnchors } from '../../src/domain/pieceEquivalence.ts';

describe('pieceEquivalence', () => {
  const pieceD1: Piece = {
    id: 'D1',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [
      { id: 'A', x: 16, y: 56 },
      { id: 'B', x: 16, y: 72 },
    ],
  };

  const pieceD2: Piece = {
    id: 'D2',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [
      { id: 'A', x: 64, y: 56 },
      { id: 'B', x: 64, y: 72 },
    ],
  };

  const pieceTriangle: Piece = {
    id: 'T1',
    shapeKind: 'triangle',
    color: 'amber',
    frameSize: 48,
    cells: [[0, 0], [48, 0], [0, 48]],
    anchors: [{ id: 'A', x: 16, y: 16 }],
  };

  it('identifies identical pieces as equivalent', () => {
    expect(arePiecesEquivalent(pieceD1, pieceD2)).toBe(true);
    expect(arePiecesEquivalent(pieceD1, pieceTriangle)).toBe(false);
  });

  it('pools anchors across equivalent pieces with unique IDs', () => {
    const dummyLevel: Level = {
      id: '1-1',
      title: 'Song Tinh',
      chapter: 1,
      contentRevision: 'v1',
      rotationEnabled: false,
      placement: 'anchors',
      pieces: [pieceD1, pieceD2, pieceTriangle],
      targetMask: new Uint8Array(128 * 160),
      targetPlacements: [],
    };

    const expanded = expandEquivalentAnchors(dummyLevel);
    const expD1 = expanded.pieces.find((p) => p.id === 'D1')!;
    const expD2 = expanded.pieces.find((p) => p.id === 'D2')!;
    const expT1 = expanded.pieces.find((p) => p.id === 'T1')!;

    // Both D1 and D2 have 4 pooled anchors
    expect(expD1.anchors.length).toBe(4);
    expect(expD2.anchors.length).toBe(4);
    expect(expT1.anchors.length).toBe(1);

    // Anchor coordinates from both D1 and D2 are available in D1
    const d1Coords = expD1.anchors.map((a) => `${a.x},${a.y}`);
    expect(d1Coords).toContain('16,56');
    expect(d1Coords).toContain('64,56');
  });
});
