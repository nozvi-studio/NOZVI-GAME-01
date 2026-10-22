import { describe, expect, it } from 'vitest';
import type { Level, Piece, PuzzleState } from '../../src/domain/model.ts';
import { expandEquivalentAnchors } from '../../src/domain/pieceEquivalence.ts';
import { applyCommand } from '../../src/domain/session.ts';

describe('sessionEquivalence', () => {
  const pieceD1: Piece = {
    id: 'D1',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [{ id: 'A', x: 16, y: 56 }],
  };

  const pieceD2: Piece = {
    id: 'D2',
    shapeKind: 'diamond',
    color: 'amber',
    frameSize: 48,
    cells: [[24, 0], [0, 24], [24, 48], [48, 24]],
    anchors: [{ id: 'A', x: 64, y: 56 }],
  };

  const level = expandEquivalentAnchors({
    id: '1-1',
    title: 'Song Tinh',
    chapter: 1,
    contentRevision: 'v1',
    rotationEnabled: false,
    placement: 'anchors',
    pieces: [pieceD1, pieceD2],
    targetMask: new Uint8Array(128 * 160),
    targetPlacements: [],
  });

  it('rejects snapping onto an anchor already occupied by another piece', () => {
    // Initial state: D1 is already snapped at (16, 56)
    const state: PuzzleState = {
      levelId: '1-1',
      phase: 'playing',
      pieces: {
        D1: { kind: 'snapped', anchorId: 'A', turns: 0 },
        D2: { kind: 'tray', turns: 0 },
      },
    };

    // Attempt to drop D2 onto (16, 56)
    const transition = applyCommand(level, state, {
      type: 'drop',
      pieceId: 'D2',
      x: 16,
      y: 56,
    });

    expect(transition.accepted).toBe(true);
    // Should NOT snap to (16, 56) because D1 is already there; outcome should be temporary
    expect(transition.outcome).toBe('temporary');
    expect(transition.state.pieces.D2.kind).toBe('temporary');
  });

  it('allows piece to be dropped back onto its own occupied anchor', () => {
    const state: PuzzleState = {
      levelId: '1-1',
      phase: 'playing',
      pieces: {
        D1: { kind: 'snapped', anchorId: 'A', turns: 0 },
        D2: { kind: 'tray', turns: 0 },
      },
    };

    const transition = applyCommand(level, state, {
      type: 'drop',
      pieceId: 'D1',
      x: 16,
      y: 56,
    });

    expect(transition.outcome).toBe('snapped');
    expect(transition.state.pieces.D1.kind).toBe('snapped');
  });
});
