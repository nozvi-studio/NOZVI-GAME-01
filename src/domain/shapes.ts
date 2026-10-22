import type { Cell, Orientation, ShapeKind } from './model.ts';

/** Một đỉnh đa giác theo toạ độ khung mảnh (gốc trên-trái), đơn vị ô logic. */
export type Vertex = Readonly<{ x: number; y: number }>;

/** Hình tròn là đa giác đều nội tiếp; 32 chia hết cho 4 nên bất biến khi xoay 90°. */
export const CIRCLE_SEGMENTS = 32;

/** Khung lớn nhất bằng bề ngang bàn. */
const MAX_FRAME = 128;

/**
 * Đỉnh hình tròn không nguyên nên phép so tâm ô với cạnh cần ngưỡng. Với đa
 * giác có đỉnh nguyên, mọi giá trị đều là bội của 0.5 nên ngưỡng không đổi
 * kết quả cũ.
 */
const EDGE_EPSILON = 1e-9;

function v(x: number, y: number): Vertex {
  return { x, y };
}

export function isValidOrientation(kind: ShapeKind, orientation: number): orientation is Orientation {
  if (!Number.isInteger(orientation)) return false;
  if (kind === 'triangle') return orientation >= 0 && orientation <= 7;
  if (kind === 'parallelogram') return orientation >= 0 && orientation <= 3;
  return orientation === 0;
}

/**
 * Khung bám lưới hiển thị (spec A mục 3): mọi đỉnh của mảnh đặt ở neo bội
 * của 8 đều rơi vào giao điểm lưới. Công cụ authoring và bộ ghép hình dùng
 * hàm này.
 */
export function isValidFrame(kind: ShapeKind, orientation: Orientation, frameSize: number): boolean {
  if (!Number.isInteger(frameSize) || frameSize < 16 || frameSize > MAX_FRAME) return false;
  switch (kind) {
    case 'square':
      return frameSize % 8 === 0;
    case 'triangle':
      return orientation < 4 ? frameSize % 8 === 0 : frameSize % 16 === 0;
    case 'diamond':
    case 'circle':
      return frameSize % 16 === 0;
    case 'parallelogram':
      return frameSize % 24 === 0;
  }
}

/**
 * Khung hợp lệ về cấu trúc: đỉnh của đa giác chuẩn có toạ độ nguyên (trừ
 * hình tròn, chỉ cần tâm nguyên) và khung vừa bàn. Validator dùng hàm này để
 * fixture kỹ thuật (thoi khung 40) vẫn hợp lệ; luật bám lưới để cho authoring.
 */
export function isStructuralFrame(kind: ShapeKind, orientation: Orientation, frameSize: number): boolean {
  if (!Number.isInteger(frameSize) || frameSize < 1 || frameSize > MAX_FRAME) return false;
  switch (kind) {
    case 'square':
      return true;
    case 'triangle':
      return orientation < 4 || frameSize % 2 === 0;
    case 'diamond':
    case 'circle':
      return frameSize % 2 === 0;
    case 'parallelogram':
      return frameSize % 3 === 0;
  }
}

function circlePolygon(frameSize: number): Vertex[] {
  const h = frameSize / 2;
  const points: Vertex[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
    points.push(v(h + h * Math.cos(a), h + h * Math.sin(a)));
  }
  return points;
}

function parallelogramPolygon(orientation: Orientation, frameSize: number): Vertex[] {
  const k = frameSize / 3;
  switch (orientation) {
    case 0:
      return [v(k, k), v(3 * k, k), v(2 * k, 2 * k), v(0, 2 * k)];
    case 1:
      return [v(2 * k, k), v(2 * k, 3 * k), v(k, 2 * k), v(k, 0)];
    case 2:
      return [v(0, k), v(2 * k, k), v(3 * k, 2 * k), v(k, 2 * k)];
    default:
      return [v(2 * k, 0), v(2 * k, 2 * k), v(k, 3 * k), v(k, k)];
  }
}

/**
 * Đa giác chuẩn của một hình trong khung frameSize × frameSize.
 *
 * Đây là nguồn duy nhất cho cells, renderer và ảnh xem trước: cells raster hoá
 * từ chính đa giác này nên không thể lệch khỏi hình vẽ (LVL-02).
 */
export function shapePolygon(kind: ShapeKind, orientation: Orientation, frameSize: number): Vertex[] {
  const s = frameSize;
  const h = frameSize / 2;
  if (kind === 'square') return [v(0, 0), v(s, 0), v(s, s), v(0, s)];
  if (kind === 'diamond') return [v(h, 0), v(s, h), v(h, s), v(0, h)];
  if (kind === 'circle') return circlePolygon(frameSize);
  if (kind === 'parallelogram') return parallelogramPolygon(orientation, frameSize);
  switch (orientation) {
    case 0:
      return [v(0, 0), v(s, 0), v(0, s)];
    case 1:
      return [v(0, 0), v(s, 0), v(s, s)];
    case 2:
      return [v(s, 0), v(s, s), v(0, s)];
    case 3:
      return [v(0, 0), v(0, s), v(s, s)];
    case 4:
      return [v(0, s), v(s, s), v(h, h)];
    case 5:
      return [v(0, 0), v(0, s), v(h, h)];
    case 6:
      return [v(0, 0), v(s, 0), v(h, h)];
    case 7:
      return [v(s, 0), v(s, s), v(h, h)];
  }
}

/**
 * Hướng sau khi xoay `turns` nấc 90° theo chiều kim đồng hồ.
 * Tam giác: góc quay vòng 0→1→2→3, mái 4→5→6→7. Bình hành đối xứng tâm nên
 * quay vòng 0→1→0 và 2→3→2. Vuông, thoi, tròn không đổi.
 */
export function effectiveOrientation(
  kind: ShapeKind,
  orientation: Orientation,
  turns: number
): Orientation {
  if (kind === 'parallelogram') {
    const family = orientation < 2 ? 0 : 2;
    const step = (((orientation % 2) + turns) % 2 + 2) % 2;
    return (family + step) as Orientation;
  }
  if (kind !== 'triangle') return 0;
  const family = orientation < 4 ? 0 : 4;
  const step = (((orientation % 4) + turns) % 4 + 4) % 4;
  return (family + step) as Orientation;
}

const MIRROR_TRIANGLE_X: readonly Orientation[] = [1, 0, 3, 2, 4, 7, 6, 5];
const MIRROR_TRIANGLE_Y: readonly Orientation[] = [3, 2, 1, 0, 6, 5, 4, 7];
const MIRROR_PARALLELOGRAM: readonly Orientation[] = [2, 3, 0, 1];

/**
 * Hướng của ảnh gương. `axis = 'x'` là lật trái–phải (qua đường thẳng đứng),
 * `'y'` là lật trên–dưới. Bình hành lật theo trục nào cũng đổi chiều nghiêng.
 */
export function mirrorOrientation(kind: ShapeKind, orientation: Orientation, axis: 'x' | 'y'): Orientation {
  if (kind === 'triangle') {
    return (axis === 'x' ? MIRROR_TRIANGLE_X : MIRROR_TRIANGLE_Y)[orientation];
  }
  if (kind === 'parallelogram') return MIRROR_PARALLELOGRAM[orientation];
  return 0;
}

type Edge = { ax: number; ay: number; nx: number; ny: number; inclusive: boolean };

/** Các cạnh kèm pháp tuyến hướng vào trong; đa giác lồi nên lấy trọng tâm đỉnh làm mốc. */
function edgesOf(polygon: readonly Vertex[]): Edge[] {
  const n = polygon.length;
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / n;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / n;
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % n];
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    if (nx * (cx - a.x) + ny * (cy - a.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    // Quy tắc trên-trái: chỉ cạnh trái (phần trong ở bên phải) và cạnh trên
    // nằm ngang (phần trong ở bên dưới) giữ ô có tâm nằm đúng trên cạnh.
    const inclusive = nx > EDGE_EPSILON || (Math.abs(nx) <= EDGE_EPSILON && ny > 0);
    return { ax: a.x, ay: a.y, nx, ny, inclusive };
  });
}

/**
 * Raster hoá đa giác lồi: lấy ô có tâm nằm trong đa giác. Hai hình chung một
 * đoạn cạnh luôn có pháp tuyến ngược chiều nên đúng một bên giữ hàng ô trên
 * cạnh đó: không trùng ô, không hở khe.
 */
export function rasterize(polygon: readonly Vertex[], frameSize: number): Cell[] {
  const edges = edgesOf(polygon);
  const cells: Cell[] = [];
  for (let y = 0; y < frameSize; y++) {
    for (let x = 0; x < frameSize; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = true;
      for (const e of edges) {
        const d = e.nx * (px - e.ax) + e.ny * (py - e.ay);
        if (d < -EDGE_EPSILON || (Math.abs(d) <= EDGE_EPSILON && !e.inclusive)) {
          inside = false;
          break;
        }
      }
      if (inside) cells.push([x, y]);
    }
  }
  return cells;
}

export function shapeCells(kind: ShapeKind, orientation: Orientation, frameSize: number): Cell[] {
  return rasterize(shapePolygon(kind, orientation, frameSize), frameSize);
}
