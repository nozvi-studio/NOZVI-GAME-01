import type { Level, Piece, PieceState, Placement, PuzzleState, Transition } from './model.ts';
import { GRID_WIDTH, TOTAL_CELLS } from './model.ts';
import { turnedCells } from './geometry.ts';
import { evaluate, matchesTarget } from './mask.ts';
import { arePiecesEquivalent } from './pieceEquivalence.ts';
import { placementsOf } from './session.ts';
import { targetIndex } from './targetMatch.ts';

export type HintResult = Readonly<{
  /** The piece the hint put on its target; feedback plays for this one. */
  pieceId: string;
  transition: Transition;
}>;

/** Pieces in the tray are offered first, then loose ones, then pieces placed in the wrong spot. */
const KIND_RANK: Record<PieceState['kind'], number> = { tray: 0, temporary: 1, snapped: 2, placed: 2 };

function placedState(level: Level, piece: Piece, target: Placement): PieceState | null {
  if (level.placement === 'free') return { kind: 'placed', x: target.x, y: target.y, turns: target.turns };
  const anchor = piece.anchors.find((a) => a.x === target.x && a.y === target.y);
  return anchor ? { kind: 'snapped', anchorId: anchor.id, turns: target.turns } : null;
}

function cellSet(piece: Piece, placement: Placement): Set<number> {
  const cells = new Set<number>();
  for (const [cx, cy] of turnedCells(piece, placement.turns)) {
    cells.add((placement.y + cy) * GRID_WIDTH + (placement.x + cx));
  }
  return cells;
}

/**
 * Puts one piece that is not on its target exactly there, using the level's sample solution.
 *
 * Any other piece that sits on the cells being filled goes back to the tray (turns kept), because the
 * mask is parity based and a stray piece there would cancel the hint. Returns null when the level has no
 * sample solution, is already won, or every piece is already on its target.
 */
export function applyHint(level: Level, state: PuzzleState): HintResult | null {
  const targets = level.targetPlacements ?? [];
  if (state.phase === 'won' || targets.length === 0) return null;

  const placements = placementsOf(level, state);
  const taken = new Set<number>();
  const onTarget = new Set<string>();
  for (const placement of placements) {
    const i = targetIndex(level, placement, taken);
    if (i !== -1) {
      taken.add(i);
      onTarget.add(placement.pieceId);
    }
  }

  const candidates = level.pieces
    .filter((piece) => !onTarget.has(piece.id))
    .sort((a, b) => KIND_RANK[state.pieces[a.id].kind] - KIND_RANK[state.pieces[b.id].kind]);

  for (const piece of candidates) {
    for (let i = 0; i < targets.length; i++) {
      if (taken.has(i)) continue;
      const target = targets[i];
      const owner = level.pieces.find((p) => p.id === target.pieceId);
      if (!owner || !arePiecesEquivalent(piece, owner)) continue;
      const next = placedState(level, piece, target);
      if (!next) continue;

      const filled = cellSet(piece, target);
      const pieces: Record<string, PieceState> = { ...state.pieces };
      for (const other of placements) {
        if (other.pieceId === piece.id || onTarget.has(other.pieceId)) continue;
        const otherPiece = level.pieces.find((p) => p.id === other.pieceId)!;
        if ([...cellSet(otherPiece, other)].some((cell) => filled.has(cell))) {
          pieces[other.pieceId] = { kind: 'tray', turns: state.pieces[other.pieceId].turns };
        }
      }
      pieces[piece.id] = next;

      const nextState: PuzzleState = { ...state, pieces };
      const mask = evaluate(level, placementsOf(level, nextState));
      const before = evaluate(level, placements);
      const changed: number[] = [];
      for (let cell = 0; cell < TOTAL_CELLS; cell++) if (before[cell] !== mask[cell]) changed.push(cell);
      const becameWon = matchesTarget(mask, level.targetMask);
      return {
        pieceId: piece.id,
        transition: {
          accepted: true,
          outcome: becameWon ? 'won' : 'snapped',
          state: becameWon ? { ...nextState, phase: 'won' } : nextState,
          mask,
          changed,
          becameWon,
        },
      };
    }
  }
  return null;
}
