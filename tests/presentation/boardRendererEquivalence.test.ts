import { describe, expect, it } from 'vitest';
import type { Piece } from '../../src/domain/model.ts';
import { arePiecesEquivalent } from '../../src/domain/pieceEquivalence.ts';

describe('boardRendererEquivalence', () => {
  const d1: Piece = {
    id: 'D1',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [{ id: 'A', x: 16, y: 56 }],
  };
  const d2: Piece = {
    id: 'D2',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [{ id: 'A', x: 64, y: 56 }],
  };

  it('matches equivalent pieces for target silhouette hover check', () => {
    const isHoverCandidate = (dragId: string, targetPieceId: string) => {
      const dragPiece = [d1, d2].find((p) => p.id === dragId);
      const targetPiece = [d1, d2].find((p) => p.id === targetPieceId);
      if (!dragPiece || !targetPiece) return false;
      return dragPiece.id === targetPiece.id || arePiecesEquivalent(dragPiece, targetPiece);
    };

    expect(isHoverCandidate('D2', 'D1')).toBe(true);
    expect(isHoverCandidate('D1', 'D2')).toBe(true);
  });
});
