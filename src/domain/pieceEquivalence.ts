import type { Anchor, Level, Piece, PuzzleState } from './model.ts';

export function arePiecesEquivalent(p1: Piece, p2: Piece): boolean {
  if (p1.id === p2.id) return true;
  if (p1.shapeKind !== p2.shapeKind || p1.frameSize !== p2.frameSize) return false;
  if (p1.cells.length !== p2.cells.length) return false;

  const cellSet = new Set(p1.cells.map(([x, y]) => `${x},${y}`));
  return p2.cells.every(([x, y]) => cellSet.has(`${x},${y}`));
}

export function expandEquivalentAnchors(level: Level): Level {
  if (level.placement === 'free' || level.pieces.length <= 1) {
    return level;
  }

  // Find equivalence groups
  const groups: Piece[][] = [];
  for (const piece of level.pieces) {
    let matchedGroup = groups.find((g) => arePiecesEquivalent(g[0], piece));
    if (!matchedGroup) {
      matchedGroup = [];
      groups.push(matchedGroup);
    }
    matchedGroup.push(piece);
  }

  const nextPieces = level.pieces.map((piece) => {
    const group = groups.find((g) => arePiecesEquivalent(g[0], piece));
    if (!group || group.length <= 1) {
      return piece;
    }

    // Pool all anchors across the group
    const pooledAnchors: Anchor[] = [];
    const seenCoord = new Set<string>();

    for (const groupPiece of group) {
      for (const a of groupPiece.anchors) {
        const coordKey = `${a.x},${a.y}`;
        if (!seenCoord.has(coordKey)) {
          seenCoord.add(coordKey);
          // Keep unique anchor id qualified by piece owner if collision occurs
          const id = groupPiece.id === piece.id ? a.id : `${groupPiece.id}:${a.id}`;
          pooledAnchors.push({ id, x: a.x, y: a.y });
        }
      }
    }

    return {
      ...piece,
      anchors: pooledAnchors,
    };
  });

  return {
    ...level,
    pieces: nextPieces,
  };
}

/**
 * Toạ độ neo đã bị mảnh khác chiếm, tính theo mảnh `piece` đang thả. Chỉ mảnh
 * tương đương (cùng hình) mới chặn nhau; hai nửa bù nhau như T3/T4 màn 1-4 được
 * dùng chung một gốc.
 */
export function occupiedAnchorCoords(level: Level, state: PuzzleState, piece: Piece): Set<string> {
  const occupied = new Set<string>();
  for (const [pId, pState] of Object.entries(state.pieces)) {
    if (pId === piece.id) continue;
    const other = level.pieces.find((p) => p.id === pId);
    if (!other || !arePiecesEquivalent(piece, other)) continue;
    if (pState.kind === 'snapped') {
      const anchor = other.anchors.find((a) => a.id === pState.anchorId);
      if (anchor) occupied.add(`${anchor.x},${anchor.y}`);
    } else if (pState.kind === 'placed') {
      occupied.add(`${pState.x},${pState.y}`);
    }
  }
  return occupied;
}
