import { parityLayers } from '../board/polygonClip.ts';
import type { ParityLayer, Pt } from '../board/polygonClip.ts';

const round = (v: number): number => Math.round(v * 1000) / 1000;

/** Khoá ổn định của một lớp: độ sâu + tập đỉnh (không phụ thuộc đỉnh bắt đầu) */
export function layerKey(layer: ParityLayer): string {
  const points = layer.points.map((p) => `${round(p.x)},${round(p.y)}`).sort().join(';');
  return `${layer.depth}|${points}`;
}

export function diffLayers(
  prev: readonly ParityLayer[],
  next: readonly ParityLayer[]
): { kept: ParityLayer[]; added: ParityLayer[] } {
  const before = new Set(prev.map(layerKey));
  const kept: ParityLayer[] = [];
  const added: ParityLayer[] = [];
  for (const layer of next) (before.has(layerKey(layer)) ? kept : added).push(layer);
  return { kept, added };
}

/** Chỉ vùng giao (≥ 2 lớp); lớp đơn đã là chính mảnh */
export function overlapLayers(polygons: readonly (readonly Pt[])[]): ParityLayer[] {
  return parityLayers(polygons).filter((layer) => layer.depth >= 2);
}

/**
 * Đoạn đường gấp trên chu vi, bắt đầu ở `startFrac` chu vi, dài `lengthFrac`
 * chu vi, quấn qua điểm đầu. Dùng cho vệt sáng chạy dọc mép vùng giao.
 */
export function perimeterSegment(points: readonly Pt[], startFrac: number, lengthFrac: number): Pt[] {
  const n = points.length;
  if (n < 2 || lengthFrac <= 0) return [];
  const lens = points.map((a, i) => {
    const b = points[(i + 1) % n];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
  const total = lens.reduce((sum, l) => sum + l, 0);
  if (total === 0) return [];

  const along = (i: number, d: number): Pt => {
    const a = points[i];
    const b = points[(i + 1) % n];
    const k = lens[i] === 0 ? 0 : d / lens[i];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  const startDist = (((startFrac % 1) + 1) % 1) * total;
  let edge = 0;
  let acc = 0;
  while (edge < n - 1 && acc + lens[edge] < startDist) {
    acc += lens[edge];
    edge++;
  }
  let pos = startDist - acc;
  let remaining = Math.min(1, lengthFrac) * total;
  const out: Pt[] = [along(edge, pos)];
  while (remaining > 1e-9) {
    const room = lens[edge] - pos;
    if (remaining <= room) {
      out.push(along(edge, pos + remaining));
      break;
    }
    remaining -= room;
    edge = (edge + 1) % n;
    pos = 0;
    out.push({ ...points[edge] });
  }
  return out;
}
