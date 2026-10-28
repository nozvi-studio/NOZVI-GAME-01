import type { Level, Placement, PuzzleState } from './model.ts';
import { arePiecesEquivalent } from './pieceEquivalence.ts';
import { placementsOf } from './session.ts';

/** Index of the sample-solution placement this one fills (an identical piece may stand in), or -1. */
function targetIndex(level: Level, placement: Placement, taken: ReadonlySet<number>): number {
  const piece = level.pieces.find((p) => p.id === placement.pieceId);
  if (!piece) return -1;
  const targets = level.targetPlacements ?? [];
  return targets.findIndex((t, i) => {
    if (taken.has(i) || t.x !== placement.x || t.y !== placement.y || t.turns !== placement.turns) return false;
    const owner = level.pieces.find((p) => p.id === t.pieceId);
    return owner !== undefined && arePiecesEquivalent(piece, owner);
  });
}

/**
 * True when `placement` is where a sample solution puts this piece (or an identical one), at the same turns.
 * Landing on the grid is not enough: in free placement every drop snaps to the grid.
 */
export function isOnTarget(level: Level, placement: Placement): boolean {
  return targetIndex(level, placement, new Set()) !== -1;
}

/**
 * Pieces standing on their target: what "X/N matched" counts. A won level counts all of them, since the win
 * test is on the mask and a level may have a solution other than the sample one.
 */
export function matchedPieceCount(level: Level, state: PuzzleState): number {
  if (state.phase === 'won') return level.pieces.length;
  const taken = new Set<number>();
  for (const placement of placementsOf(level, state)) {
    const i = targetIndex(level, placement, taken);
    if (i !== -1) taken.add(i);
  }
  return taken.size;
}
