import { GRID_TOKENS } from '../designTokens.ts';

export type Segment = { x1: number; y1: number; x2: number; y2: number };

export type GridLayerName = 'fine' | 'diagonal' | 'module' | 'axis' | 'tick';

export type GridLayer = {
  name: GridLayerName;
  segments: Segment[];
};

export type BoardBox = { x: number; y: number; width: number; height: number };

/** Một ô lưới hiển thị, tính bằng pixel canvas: 8 ô logic x 5px = 40px */
export const DISPLAY_CELL_PX =
  GRID_TOKENS.logicCellPx * GRID_TOKENS.displayCellInLogicCells;

/** Một module: 3 ô lưới hiển thị = 120px */
export const MODULE_PX = DISPLAY_CELL_PX * GRID_TOKENS.moduleInDisplayCells;

function lineGrid(board: BoardBox, step: number): Segment[] {
  const segments: Segment[] = [];
  for (let x = board.x; x <= board.x + board.width; x += step) {
    segments.push({ x1: x, y1: board.y, x2: x, y2: board.y + board.height });
  }
  for (let y = board.y; y <= board.y + board.height; y += step) {
    segments.push({ x1: board.x, y1: y, x2: board.x + board.width, y2: y });
  }
  return segments;
}

/**
 * Cắt một đoạn thẳng vào trong hộp bàn chơi theo thuật toán Liang–Barsky.
 * Trả về null nếu đoạn nằm hoàn toàn ngoài hộp.
 */
function clipToBox(s: Segment, board: BoardBox): Segment | null {
  const xMin = board.x;
  const xMax = board.x + board.width;
  const yMin = board.y;
  const yMax = board.y + board.height;

  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;

  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [s.x1 - xMin, xMax - s.x1, s.y1 - yMin, yMax - s.y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // song song và nằm ngoài
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  if (t0 >= t1) return null;

  return {
    x1: s.x1 + t0 * dx,
    y1: s.y1 + t0 * dy,
    x2: s.x1 + t1 * dx,
    y2: s.y1 + t1 * dy,
  };
}

/**
 * Đường chéo 45 độ theo cả hai chiều, cách nhau một module.
 *
 * Dựng đoạn dài vượt hẳn bàn rồi cắt vào biên, thay vì tính giao điểm bằng
 * tay cho từng trường hợp — ít chỗ sai hơn và luôn cho hệ số góc đúng 45 độ.
 */
function diagonals(board: BoardBox): Segment[] {
  const { x, y, width, height } = board;
  const span = width + height;
  const segments: Segment[] = [];

  for (let offset = -height; offset <= width + height; offset += MODULE_PX) {
    // Chiều xuống-phải
    const down = clipToBox(
      { x1: x + offset, y1: y, x2: x + offset + span, y2: y + span },
      board
    );
    if (down) segments.push(down);

    // Chiều lên-phải
    const up = clipToBox(
      { x1: x + offset, y1: y + height, x2: x + offset + span, y2: y + height - span },
      board
    );
    if (up) segments.push(up);
  }

  // Bỏ các đoạn suy biến thành một điểm ở đúng góc bàn
  return segments.filter((s) => Math.abs(s.x2 - s.x1) > 0.5);
}

function axes(board: BoardBox): Segment[] {
  const cx = board.x + board.width / 2;
  const cy = board.y + board.height / 2;
  return [
    { x1: cx, y1: board.y, x2: cx, y2: board.y + board.height },
    { x1: board.x, y1: cy, x2: board.x + board.width, y2: cy },
  ];
}

/**
 * Vạch thước ở bốn mép bàn. Vạch rơi vào đường module dài hơn vạch thường,
 * cho mắt bắt được nhịp 3 ô mà không cần đếm.
 */
function ticks(board: BoardBox): Segment[] {
  const segments: Segment[] = [];
  const { shortLen, longLen } = GRID_TOKENS.tick;
  const right = board.x + board.width;
  const bottom = board.y + board.height;

  for (let x = board.x; x <= right; x += DISPLAY_CELL_PX) {
    const len = (x - board.x) % MODULE_PX === 0 ? longLen : shortLen;
    segments.push({ x1: x, y1: board.y, x2: x, y2: board.y + len });
    segments.push({ x1: x, y1: bottom, x2: x, y2: bottom - len });
  }
  for (let y = board.y; y <= bottom; y += DISPLAY_CELL_PX) {
    const len = (y - board.y) % MODULE_PX === 0 ? longLen : shortLen;
    segments.push({ x1: board.x, y1: y, x2: board.x + len, y2: y });
    segments.push({ x1: right, y1: y, x2: right - len, y2: y });
  }

  return segments;
}

export function buildGridLayers(board: BoardBox): GridLayer[] {
  return [
    { name: 'fine', segments: lineGrid(board, DISPLAY_CELL_PX) },
    { name: 'diagonal', segments: diagonals(board) },
    { name: 'module', segments: lineGrid(board, MODULE_PX) },
    { name: 'axis', segments: axes(board) },
    { name: 'tick', segments: ticks(board) },
  ];
}

/** Bốn dấu ngắm chữ L ở bốn góc bàn, mỗi dấu gồm hai đoạn. */
export function buildCornerMarks(board: BoardBox): Segment[] {
  const { armLen, inset } = GRID_TOKENS.corner;
  const left = board.x + inset;
  const right = board.x + board.width - inset;
  const top = board.y + inset;
  const bottom = board.y + board.height - inset;

  return [
    { x1: left, y1: top + armLen, x2: left, y2: top },
    { x1: left, y1: top, x2: left + armLen, y2: top },
    { x1: right, y1: top + armLen, x2: right, y2: top },
    { x1: right, y1: top, x2: right - armLen, y2: top },
    { x1: left, y1: bottom - armLen, x2: left, y2: bottom },
    { x1: left, y1: bottom, x2: left + armLen, y2: bottom },
    { x1: right, y1: bottom - armLen, x2: right, y2: bottom },
    { x1: right, y1: bottom, x2: right - armLen, y2: bottom },
  ];
}
