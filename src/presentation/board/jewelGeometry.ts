import { PIECE_TOKENS } from '../designTokens.ts';

export type Point = { x: number; y: number };

export type JewelFace = {
  name: 'north' | 'east' | 'south' | 'west';
  points: Point[];
  color: string;
};

/**
 * Bốn đỉnh hình thoi, bắt đầu từ đỉnh Bắc theo chiều kim đồng hồ.
 *
 * Thoi là hình vuông xoay 45 độ: hai đường chéo nằm trên đường kẻ ngang và
 * dọc của lưới, nên mỗi cạnh có hệ số góc 45 độ và trùng đường chéo của lưới.
 */
export function jewelOutline(cx: number, cy: number, radius: number): Point[] {
  return [
    { x: cx, y: cy - radius },
    { x: cx + radius, y: cy },
    { x: cx, y: cy + radius },
    { x: cx - radius, y: cy },
  ];
}

/**
 * Bốn mặt vát, mỗi mặt là tam giác nối tâm với hai đỉnh kề.
 * Sáng ở trên-trái, tối dần xuống dưới-phải — đó là thứ tạo cảm giác viên ngọc
 * thay vì một mảng màu phẳng.
 */
export function jewelFaces(cx: number, cy: number, radius: number): JewelFace[] {
  const [n, e, s, w] = jewelOutline(cx, cy, radius);
  const center = { x: cx, y: cy };
  return [
    { name: 'north', points: [n, center, w], color: PIECE_TOKENS.faceNorth },
    { name: 'east', points: [n, e, center], color: PIECE_TOKENS.faceEast },
    { name: 'south', points: [e, s, center], color: PIECE_TOKENS.faceSouth },
    { name: 'west', points: [s, w, center], color: PIECE_TOKENS.faceWest },
  ];
}

/** Mặt bàn: thoi nhỏ đồng tâm, nơi ánh sáng tụ lại. */
export function jewelTable(cx: number, cy: number, radius: number): Point[] {
  return jewelOutline(cx, cy, radius * PIECE_TOKENS.tableRatio);
}

/** Bốn đoạn nối từ mỗi đỉnh vào mặt bàn. */
export function jewelSpineLines(
  cx: number,
  cy: number,
  radius: number
): Array<{ from: Point; to: Point }> {
  const outer = jewelOutline(cx, cy, radius);
  const inner = jewelTable(cx, cy, radius);
  return outer.map((from, index) => ({ from, to: inner[index] }));
}

/** Trung bình các đỉnh; với tam giác, vuông và thoi đây cũng là trọng tâm hình. */
export function polygonCentroid(points: readonly Point[]): Point {
  const n = points.length;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / n,
    y: points.reduce((sum, p) => sum + p.y, 0) / n,
  };
}

export function scalePolygon(points: readonly Point[], origin: Point, factor: number): Point[] {
  return points.map((p) => ({
    x: origin.x + (p.x - origin.x) * factor,
    y: origin.y + (p.y - origin.y) * factor,
  }));
}

/**
 * Bốn hướng tham chiếu của mặt vát, xếp từ sáng đến tối để khi pháp tuyến
 * nằm đúng giữa hai hướng thì lấy mặt sáng hơn. Góc đo bằng atan2 với trục y
 * hướng xuống: cạnh trên-trái của thoi có pháp tuyến ngoài −135°.
 */
const FACE_REFERENCES: ReadonlyArray<{ name: JewelFace['name']; angle: number; color: string }> = [
  { name: 'north', angle: -135, color: PIECE_TOKENS.faceNorth },
  { name: 'east', angle: -45, color: PIECE_TOKENS.faceEast },
  { name: 'west', angle: 135, color: PIECE_TOKENS.faceWest },
  { name: 'south', angle: 45, color: PIECE_TOKENS.faceSouth },
];

function faceForNormal(nx: number, ny: number): (typeof FACE_REFERENCES)[number] {
  const angle = (Math.atan2(ny, nx) * 180) / Math.PI;
  let best = FACE_REFERENCES[0];
  let bestDistance = Infinity;
  for (const ref of FACE_REFERENCES) {
    let d = Math.abs(angle - ref.angle) % 360;
    if (d > 180) d = 360 - d;
    if (d < bestDistance - 1e-9) {
      best = ref;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Mặt vát cho đa giác lồi bất kỳ: mỗi cạnh nối với trọng tâm thành một mặt,
 * màu theo hướng cạnh nhìn ra. Với thoi, kết quả trùng `jewelFaces`.
 */
export function polygonFaces(points: readonly Point[]): JewelFace[] {
  const c = polygonCentroid(points);
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    let nx = b.y - a.y;
    let ny = -(b.x - a.x);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (nx * (mx - c.x) + ny * (my - c.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const ref = faceForNormal(nx, ny);
    return { name: ref.name, points: [a, b, c], color: ref.color };
  });
}

export function polygonTable(points: readonly Point[]): Point[] {
  return scalePolygon(points, polygonCentroid(points), PIECE_TOKENS.tableRatio);
}

export function polygonSpineLines(points: readonly Point[]): Array<{ from: Point; to: Point }> {
  const inner = polygonTable(points);
  return points.map((from, index) => ({ from, to: inner[index] }));
}

/**
 * Dịch từng cạnh vào trong nửa nét rồi lấy giao điểm hai cạnh kề.
 * Đầu vào là đa giác lồi không suy biến, không có cạnh kề thẳng hàng.
 * Thoi đều có đường chéo ngang/dọc giữ cách co bán kính cũ để HUD không đổi.
 */
export function polygonStrokeOutline(points: readonly Point[], strokeWidth: number): Point[] {
  const center = polygonCentroid(points);
  const inset = strokeWidth / 2;
  const radius = Math.abs(points[0].x - center.x) + Math.abs(points[0].y - center.y);
  const legacyDiamond = points.length === 4 && radius > 0 && points.every((p, i) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const next = points[(i + 1) % points.length];
    return ((dx === 0 && Math.abs(dy) === radius) || (dy === 0 && Math.abs(dx) === radius))
      && (dx === 0) !== (next.x === center.x);
  });
  if (legacyDiamond) return scalePolygon(points, center, (radius - inset) / radius);

  const edges = points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    let nx = -dy / length;
    let ny = dx / length;
    if (nx * (center.x - a.x) + ny * (center.y - a.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { nx, ny, offset: nx * a.x + ny * a.y + inset };
  });
  return edges.map((edge, i) => {
    const previous = edges[(i + edges.length - 1) % edges.length];
    const determinant = previous.nx * edge.ny - previous.ny * edge.nx;
    return {
      x: (previous.offset * edge.ny - previous.ny * edge.offset) / determinant,
      y: (previous.nx * edge.offset - previous.offset * edge.nx) / determinant,
    };
  });
}
