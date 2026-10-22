import type { Level, Piece, Turns } from './model.ts';
import { fitsBoard, turnedCells } from './geometry.ts';

/** Khoảng cách giữa hai giao điểm lưới hiển thị, đơn vị ô logic. */
export const GRID_STEP = 8;

/** Bán kính hít 6 ô, so bằng bình phương khoảng cách (giống màn neo). */
export const SNAP_RADIUS_SQ = 36;

/**
 * Giao điểm lưới để hít mảnh ở màn đặt tự do (spec D, FP-03).
 *
 * `(gx, gy)` là gốc khung tương ứng với tâm mảnh đang kéo. Ứng viên là các
 * giao điểm (8i, 8j) mà mảnh, ở hướng `turns`, nằm gọn trong bàn. Chọn ứng
 * viên gần nhất theo Euclid; hoà thì lấy y nhỏ hơn, rồi x nhỏ hơn. Xa hơn
 * 6 ô thì trả null.
 *
 * Giao điểm cách nhau 8 ô nên chỉ 4 góc của ô lưới chứa (gx, gy) có thể nằm
 * trong bán kính 6; mọi giao điểm khác cách ít nhất 8. Duyệt 4 góc theo thứ
 * tự y rồi x với phép so `<` cho đúng luật hoà.
 */
export function nearestGridOrigin(
  piece: Piece,
  turns: Turns,
  gx: number,
  gy: number
): { x: number; y: number } | null {
  const cells = turnedCells(piece, turns);
  const x0 = Math.floor(gx / GRID_STEP) * GRID_STEP;
  const y0 = Math.floor(gy / GRID_STEP) * GRID_STEP;

  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (const y of [y0, y0 + GRID_STEP]) {
    for (const x of [x0, x0 + GRID_STEP]) {
      const d = (x - gx) ** 2 + (y - gy) ** 2;
      if (d < bestDistance && fitsBoard(cells, x, y)) {
        best = { x, y };
        bestDistance = d;
      }
    }
  }
  return best !== null && bestDistance <= SNAP_RADIUS_SQ ? best : null;
}

/** Squared target-snap radius for levels that opt in (48 ≈ 7 cells). */
export const TARGET_SNAP_RADIUS_SQ = 48;

/**
 * Snap origin for a free-placement drop (TSN-04). When the level opts in with
 * `targetSnapRadiusSq`, a drop close enough to the piece's sample-solution
 * origin, at the same turns, lands exactly on it; otherwise grid snap as before.
 * Drag preview and session drop both call this so they agree (FP-05).
 */
export function freeSnapOrigin(
  level: Level,
  piece: Piece,
  turns: Turns,
  gx: number,
  gy: number
): { x: number; y: number } | null {
  const radiusSq = level.targetSnapRadiusSq;
  if (level.placement === 'free' && radiusSq !== undefined) {
    const target = level.targetPlacements?.find((p) => p.pieceId === piece.id);
    if (target && target.turns === turns && (target.x - gx) ** 2 + (target.y - gy) ** 2 <= radiusSq) {
      return { x: target.x, y: target.y };
    }
  }
  return nearestGridOrigin(piece, turns, gx, gy);
}
