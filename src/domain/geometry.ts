import type { Cell, Orientation, ShapeKind, Turns } from './model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from './model.ts';
import { effectiveOrientation, shapeCells } from './shapes.ts';

/**
 * Xoay các ô theo chiều kim đồng hồ quanh tâm khung vuông frameSize.
 * Mỗi nấc 90°: (x, y) -> (frameSize - 1 - y, x).
 */
export function rotateCells(
  cells: readonly Cell[],
  frameSize: number,
  turns: Turns | number
): Cell[] {
  const normalizedTurns = ((turns % 4) + 4) % 4;
  if (normalizedTurns === 0) {
    return cells.map(([x, y]) => [x, y] as const);
  }

  let current = cells.map(([x, y]) => [x, y] as const);
  for (let step = 0; step < normalizedTurns; step++) {
    current = current.map(([x, y]) => [frameSize - 1 - y, x] as const);
  }
  return current;
}

/**
 * Ô của mảnh sau `turns` nấc xoay. Mảnh biết hình thì lấy ô chuẩn của *hướng hiệu
 * dụng*: hai tư thế giống hình (bình hành xoay 1 hay 3 nấc, vuông/thoi/tròn mọi
 * nấc) cho đúng cùng một tập ô, nên khớp bóng mục tiêu là thắng dù xoay đường nào.
 * Xoay thẳng các ô đã raster hoá thì ô nằm đúng trên cạnh chéo bị lệch một hàng
 * theo chiều xoay. Mảnh không có shapeKind (literal test) và nấc 0 xoay theo ô như cũ.
 */
export function turnedCells(
  piece: Readonly<{ frameSize: number; cells: readonly Cell[]; shapeKind?: ShapeKind; orientation?: Orientation }>,
  turns: Turns | number
): Cell[] {
  const normalized = ((turns % 4) + 4) % 4;
  if (normalized === 0 || !piece.shapeKind) return rotateCells(piece.cells, piece.frameSize, normalized);
  const orientation = effectiveOrientation(piece.shapeKind, piece.orientation ?? 0, normalized);
  return shapeCells(piece.shapeKind, orientation, piece.frameSize).map(([x, y]) => [x, y] as const);
}

/**
 * Kiểm tra tập ô đặt tại tọa độ (x, y) có nằm hoàn toàn trong bàn cờ 128 x 160 hay không.
 * Tọa độ x, y phải là số nguyên hữu hạn không âm và không vượt mép.
 */
export function fitsBoard(cells: readonly Cell[], x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
    return false;
  }

  for (const [cx, cy] of cells) {
    if (!Number.isInteger(cx) || !Number.isInteger(cy)) {
      return false;
    }
    const targetX = x + cx;
    const targetY = y + cy;
    if (targetX < 0 || targetX >= GRID_WIDTH || targetY < 0 || targetY >= GRID_HEIGHT) {
      return false;
    }
  }

  return true;
}
