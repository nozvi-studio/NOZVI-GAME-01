import Phaser from 'phaser';
import { PIECE_TOKENS } from '../designTokens.ts';
import {
  jewelOutline,
  polygonCentroid,
  polygonFaces,
  polygonSpineLines,
  polygonStrokeOutline,
  polygonTable,
  scalePolygon,
} from './jewelGeometry.ts';
import type { Point } from './jewelGeometry.ts';

export type JewelVariant = 'solid' | 'ghost' | 'placeholder';

export type JewelOptions = {
  cx: number;
  cy: number;
  radius: number;
  variant: JewelVariant;
  alpha?: number;
};

export type JewelPolygonOptions = {
  variant: JewelVariant;
  alpha?: number;
  /** Nửa cạnh khung mảnh tính bằng pixel — quy mô cho đốm sáng */
  sizePx: number;
};

function hex(value: string): number {
  return Phaser.Display.Color.HexStringToColor(value).color;
}

function toGeomPoints(points: readonly Point[]): Phaser.Geom.Point[] {
  return points.map((p) => new Phaser.Geom.Point(p.x, p.y));
}

function strokeDashedPolygon(
  g: Phaser.GameObjects.Graphics,
  points: readonly Point[],
  dash: readonly number[],
  closed = true
): void {
  const [on, off] = dash;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    let travelled = 0;
    while (travelled < length) {
      const end = Math.min(travelled + on, length);
      g.lineBetween(a.x + ux * travelled, a.y + uy * travelled, a.x + ux * end, a.y + uy * end);
      travelled = end + off;
    }
  }
}

/**
 * Vẽ một mảnh ngọc thoi. Giữ chữ ký cũ cho HUD và các chỗ chỉ cần thoi.
 */
export function drawJewel(g: Phaser.GameObjects.Graphics, opts: JewelOptions): void {
  drawJewelPolygon(g, jewelOutline(opts.cx, opts.cy, opts.radius), {
    variant: opts.variant,
    alpha: opts.alpha,
    sizePx: opts.radius,
  });
}

/**
 * Vẽ mảnh ngọc theo đa giác bất kỳ (vuông, tam giác, thoi).
 *
 * Viền vẽ phía trong mảnh: dịch mỗi cạnh vào nửa độ dày viền để mép nét
 * trùng đúng đường kẻ lưới — quy tắc "vẽ đúng đến từng pixel" của GridSpec.
 */
export function drawJewelPolygon(
  g: Phaser.GameObjects.Graphics,
  points: readonly Point[],
  opts: JewelPolygonOptions
): void {
  const { variant, sizePx } = opts;
  const alpha = opts.alpha ?? (variant === 'ghost' ? PIECE_TOKENS.ghostAlpha : 1);
  const outline = [...points];
  const center = polygonCentroid(outline);

  if (variant === 'placeholder') {
    g.lineStyle(
      PIECE_TOKENS.placeholderStroke.width,
      hex(PIECE_TOKENS.placeholderStroke.color),
      PIECE_TOKENS.placeholderStroke.alpha * alpha
    );
    strokeDashedPolygon(g, outline, PIECE_TOKENS.placeholderStroke.dash);
    return;
  }

  // Quầng sáng phía sau: các đa giác đồng tâm lớn dần, mờ dần. Phaser Graphics
  // không có blur nên đây là cách xấp xỉ rẻ nhất mà không phải sinh texture
  // hay thêm GameObject (render chạy mỗi khung hình, thêm object là rò rỉ).
  const glowRings = 6;
  for (let i = glowRings; i > 0; i--) {
    const t = i / glowRings;
    g.fillStyle(hex(PIECE_TOKENS.glow.color), PIECE_TOKENS.glow.alpha * (1 - t) ** 2 * alpha);
    g.fillPoints(toGeomPoints(scalePolygon(outline, center, 1 + t * 0.22)), true);
  }

  // solid và ghost: các mặt vát, mặt bàn, đoạn nối, viền trong
  for (const face of polygonFaces(outline)) {
    g.fillStyle(hex(face.color), alpha);
    g.fillPoints(toGeomPoints(face.points), true);
  }

  g.fillStyle(hex(PIECE_TOKENS.tableStops[1]), 0.6 * alpha);
  g.fillPoints(toGeomPoints(polygonTable(outline)), true);

  g.lineStyle(1, hex('#FFF7DA'), 0.45 * alpha);
  for (const line of polygonSpineLines(outline)) {
    g.lineBetween(line.from.x, line.from.y, line.to.x, line.to.y);
  }

  g.lineStyle(PIECE_TOKENS.outlineWidth, hex(PIECE_TOKENS.outline), alpha);
  g.strokePoints(toGeomPoints(polygonStrokeOutline(outline, PIECE_TOKENS.outlineWidth)), true, true);

  drawSparkle(
    g,
    center.x + sizePx * PIECE_TOKENS.sparkle.offsetRatio,
    center.y + sizePx * PIECE_TOKENS.sparkle.offsetRatio,
    sizePx * 0.12,
    PIECE_TOKENS.sparkle.alpha * alpha
  );
}

/** Đốm lấp lánh bốn cánh, lệch về phía trên-trái nơi ánh sáng tới. */
export function drawSparkle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  size: number,
  alpha: number
): void {
  const waist = size * 0.3;
  g.fillStyle(hex(PIECE_TOKENS.sparkle.color), alpha);
  g.fillPoints(
    toGeomPoints([
      { x: cx, y: cy - size },
      { x: cx + waist, y: cy },
      { x: cx, y: cy + size },
      { x: cx - waist, y: cy },
    ]),
    true
  );
  g.fillPoints(
    toGeomPoints([
      { x: cx - size, y: cy },
      { x: cx, y: cy - waist },
      { x: cx + size, y: cy },
      { x: cx, y: cy + waist },
    ]),
    true
  );
}

/**
 * Dashed outline for a target silhouette. Separate from the fill because the
 * figure is filled per placement — each keeps its own hover and reveal alpha —
 * but outlined once for the whole figure, one straight segment at a time, so
 * edges that are not the border of a lit region are not drawn at all.
 */
export function strokeTargetSegment(
  g: Phaser.GameObjects.Graphics,
  segment: readonly [{ x: number; y: number }, { x: number; y: number }],
  alpha: number
): void {
  g.lineStyle(
    PIECE_TOKENS.targetStroke.width,
    hex(PIECE_TOKENS.targetStroke.color),
    PIECE_TOKENS.targetStroke.alpha * alpha
  );
  strokeDashedPolygon(g, segment, PIECE_TOKENS.targetStroke.dash, false);
}
