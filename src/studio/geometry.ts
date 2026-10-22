import type { Cell, Piece, ShapeKind, Turns } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH, TOTAL_CELLS } from '../domain/model.ts';
import { turnedCells } from '../domain/geometry.ts';
import { shapeCells } from '../domain/shapes.ts';
import { GRID_STEP, nearestGridOrigin } from '../domain/freePlacement.ts';
import type { LevelSource, PieceSource } from '../content/authoring.ts';
import type { LevelDocument } from '../content/document.ts';

/**
 * Đếm số lớp của từng ô trên bàn đối với nghiệm mẫu thứ `solutionIndex`.
 * Trả về mảng Uint8Array độ dài 128 * 160 = 20480.
 */
export function layerCounts(
  doc: LevelDocument | LevelSource,
  solutionIndex = 0
): Uint8Array {
  const counts = new Uint8Array(TOTAL_CELLS);
  const solution = doc.sampleSolutions?.[solutionIndex];
  if (!solution) return counts;

  for (const step of solution) {
    const piece = doc.pieces.find((p) => p.id === step.pieceId);
    if (!piece) continue;

    const anchor = piece.anchors.find((a) => a.id === step.anchorId);
    if (!anchor) continue;

    const baseCells =
      'cells' in piece && Array.isArray((piece as any).cells)
        ? (piece as any).cells
        : shapeCells(piece.shapeKind, piece.orientation ?? 0, piece.frameSize);

    const rotated = turnedCells({ frameSize: piece.frameSize, cells: baseCells, shapeKind: piece.shapeKind, orientation: piece.orientation }, step.turns ?? 0);
    for (const [cx, cy] of rotated) {
      const x = anchor.x + cx;
      const y = anchor.y + cy;
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        counts[y * GRID_WIDTH + x]++;
      }
    }
  }

  return counts;
}

type Interval = [number, number];

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length <= 1) return intervals;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = merged[merged.length - 1];
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

/**
 * Sinh chuỗi SVG path `d` viền bao quanh tập ô theo tỉ lệ `scale`.
 * Các đoạn thẳng ngang và dọc liên tiếp được gom thành lệnh H và V.
 */
export function outlinePath(
  cellsInput: Array<readonly [number, number]> | Set<string> | Uint8Array,
  scale: number
): string {
  let cellSet: Set<string>;

  if (cellsInput instanceof Set) {
    cellSet = cellsInput;
  } else if (cellsInput instanceof Uint8Array) {
    cellSet = new Set<string>();
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (cellsInput[y * GRID_WIDTH + x] >= 3) {
          cellSet.add(`${x},${y}`);
        }
      }
    }
  } else {
    cellSet = new Set<string>();
    for (const [x, y] of cellsInput) {
      cellSet.add(`${x},${y}`);
    }
  }

  if (cellSet.size === 0) return '';

  const hEdges = new Map<number, Interval[]>();
  const vEdges = new Map<number, Interval[]>();

  for (const key of cellSet) {
    const comma = key.indexOf(',');
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));

    // Top edge
    if (!cellSet.has(`${x},${y - 1}`)) {
      if (!hEdges.has(y)) hEdges.set(y, []);
      hEdges.get(y)!.push([x, x + 1]);
    }
    // Bottom edge
    if (!cellSet.has(`${x},${y + 1}`)) {
      if (!hEdges.has(y + 1)) hEdges.set(y + 1, []);
      hEdges.get(y + 1)!.push([x, x + 1]);
    }
    // Left edge
    if (!cellSet.has(`${x - 1},${y}`)) {
      if (!vEdges.has(x)) vEdges.set(x, []);
      vEdges.get(x)!.push([y, y + 1]);
    }
    // Right edge
    if (!cellSet.has(`${x + 1},${y}`)) {
      if (!vEdges.has(x + 1)) vEdges.set(x + 1, []);
      vEdges.get(x + 1)!.push([y, y + 1]);
    }
  }

  const hCommands: string[] = [];
  const sortedY = Array.from(hEdges.keys()).sort((a, b) => a - b);
  for (const y of sortedY) {
    const merged = mergeIntervals(hEdges.get(y)!);
    for (const [x0, x1] of merged) {
      hCommands.push(`M${x0 * scale} ${y * scale}H${x1 * scale}`);
    }
  }

  const vCommands: string[] = [];
  const sortedX = Array.from(vEdges.keys()).sort((a, b) => a - b);
  for (const x of sortedX) {
    const merged = mergeIntervals(vEdges.get(x)!);
    for (const [y0, y1] of merged) {
      vCommands.push(`M${x * scale} ${y0 * scale}V${y1 * scale}`);
    }
  }

  return [...hCommands, ...vCommands].join('');
}

/**
 * Hít gốc mảnh vào giao điểm lưới gần nhất và kẹp để khung mảnh nằm trọn trong bàn.
 */
export function snapAndClamp(
  piece: Piece | PieceSource,
  turns: Turns,
  gx: number,
  gy: number
): { x: number; y: number } {
  const shapeKind: ShapeKind = (piece as PieceSource).shapeKind ?? 'square';
  const orientation = piece.orientation ?? 0;
  const p: Piece =
    'cells' in piece && Array.isArray((piece as any).cells)
      ? (piece as Piece)
      : {
          id: piece.id,
          shapeKind,
          orientation,
          frameSize: piece.frameSize,
          color: 'amber',
          cells: shapeCells(shapeKind, orientation, piece.frameSize) as Cell[],
          anchors: piece.anchors,
        };

  const snapped = nearestGridOrigin(p, turns, gx, gy);
  let x = snapped ? snapped.x : Math.round(gx / GRID_STEP) * GRID_STEP;
  let y = snapped ? snapped.y : Math.round(gy / GRID_STEP) * GRID_STEP;

  const maxFrameX = Math.max(0, GRID_WIDTH - piece.frameSize);
  const maxFrameY = Math.max(0, GRID_HEIGHT - piece.frameSize);

  x = Math.max(0, Math.min(maxFrameX, x));
  y = Math.max(0, Math.min(maxFrameY, y));

  x = Math.round(x / GRID_STEP) * GRID_STEP;
  y = Math.round(y / GRID_STEP) * GRID_STEP;

  return { x, y };
}
