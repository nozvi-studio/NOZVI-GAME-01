import { describe, expect, test } from 'vitest';
import type { PieceSource } from '../src/content/authoring.ts';
import { CROSS, NUDGE, concentric, mirrorX, mirrorY, piece, row } from '../src/content/kit.ts';
import type { Orientation } from '../src/domain/model.ts';
import { shapeCells, shapePolygon } from '../src/domain/shapes.ts';
import type { Vertex } from '../src/domain/shapes.ts';

/** Tâm điểm nằm đúng trên một cạnh của đa giác (kể cả đầu mút). */
function onOutline(polygon: readonly Vertex[], px: number, py: number): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    const within =
      px >= Math.min(a.x, b.x) &&
      px <= Math.max(a.x, b.x) &&
      py >= Math.min(a.y, b.y) &&
      py <= Math.max(a.y, b.y);
    if (cross === 0 && within) return true;
  }
  return false;
}

/** Ô tuyệt đối trên bàn của mảnh đặt ở neo A. */
function absoluteCells(p: PieceSource): Set<string> {
  const a = p.anchors[0];
  return new Set(
    shapeCells(p.shapeKind, p.orientation, p.frameSize).map(([x, y]) => `${a.x + x},${a.y + y}`)
  );
}

/**
 * So ảnh gương bằng tập ô: phản chiếu từng ô của mảnh gốc rồi so với raster
 * của mảnh lật. Chỉ được lệch ở ô có tâm nằm đúng trên viền (quy tắc trên-trái).
 */
function expectMirrorImage(
  original: PieceSource,
  mirrored: PieceSource,
  reflect: (x: number, y: number) => readonly [number, number]
): void {
  const reflected = new Set(
    [...absoluteCells(original)].map((k) => {
      const [x, y] = k.split(',').map(Number);
      const [rx, ry] = reflect(x, y);
      return `${rx},${ry}`;
    })
  );
  const direct = absoluteCells(mirrored);
  const polygon = shapePolygon(mirrored.shapeKind, mirrored.orientation, mirrored.frameSize);
  const a = mirrored.anchors[0];
  const diff = [
    ...[...reflected].filter((k) => !direct.has(k)),
    ...[...direct].filter((k) => !reflected.has(k)),
  ];
  expect(diff.length).toBeLessThanOrEqual(2 * mirrored.frameSize);
  for (const k of diff) {
    const [x, y] = k.split(',').map(Number);
    expect(onOutline(polygon, x - a.x + 0.5, y - a.y + 0.5)).toBe(true);
  }
}

describe('piece: đặt mảnh theo tâm khung', () => {
  test('đổi tâm ra gốc khung = tâm − khung/2', () => {
    expect(piece('S1', 'square', 48, [64, 80])).toEqual({
      id: 'S1',
      shapeKind: 'square',
      orientation: 0,
      frameSize: 48,
      anchors: [{ id: 'A', x: 40, y: 56 }],
    });
  });

  test('neo nhiễu đặt tên B, C, D… theo thứ tự độ lệch', () => {
    const p = piece('T1', 'triangle', 48, [40, 56], { orientation: 4, decoys: NUDGE });
    expect(p.orientation).toBe(4);
    expect(p.anchors).toEqual([
      { id: 'A', x: 16, y: 32 },
      { id: 'B', x: 24, y: 32 },
      { id: 'C', x: 8, y: 32 },
      { id: 'D', x: 16, y: 40 },
    ]);
  });

  test('hằng neo nhiễu sẵn có', () => {
    expect(NUDGE).toEqual([[8, 0], [-8, 0], [0, 8]]);
    expect(CROSS).toEqual([[8, 0], [-8, 0], [0, 8], [0, -8]]);
  });

  test('từ chối tâm cho gốc khung lệch lưới', () => {
    expect(() => piece('S1', 'square', 48, [60, 80])).toThrow(/không phải bội của 8/);
  });

  test('từ chối khung sai loại hình và neo nhiễu lệch lưới', () => {
    expect(() => piece('K1', 'diamond', 24, [64, 80])).toThrow(/khung 24 không hợp lệ cho diamond/);
    expect(() => piece('S1', 'square', 48, [64, 80], { decoys: [[4, 0]] })).toThrow(/neo nhiễu \(4, 0\)/);
    expect(() =>
      piece('S1', 'square', 48, [64, 80], {
        decoys: [[8, 0], [-8, 0], [0, 8], [0, -8], [16, 0], [-16, 0]],
      })
    ).toThrow(/tối đa 5 neo nhiễu/);
  });
});

describe('mirrorX / mirrorY: ảnh gương đối chiếu bằng tập ô', () => {
  test('mirrorX mỗi hướng tam giác', () => {
    for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) {
      const p = piece('P', 'triangle', 48, [40, 56], { orientation: o });
      const m = mirrorX(p, 64, 'Q');
      expect(m.anchors[0]).toEqual({ id: 'A', x: 64, y: 32 });
      expectMirrorImage(p, m, (x, y) => [127 - x, y]);
    }
  });

  test('mirrorX mỗi hướng bình hành', () => {
    for (const o of [0, 1, 2, 3] as const) {
      const p = piece('P', 'parallelogram', 48, [40, 56], { orientation: o });
      const m = mirrorX(p, 64, 'Q');
      expect(m.orientation).toBe(([2, 3, 0, 1] as const)[o]);
      expectMirrorImage(p, m, (x, y) => [127 - x, y]);
    }
  });

  test('mirrorY mỗi hướng tam giác và bình hành', () => {
    for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) {
      const p = piece('P', 'triangle', 48, [40, 56], { orientation: o });
      const m = mirrorY(p, 80, 'Q');
      expect(m.anchors[0]).toEqual({ id: 'A', x: 16, y: 80 });
      expectMirrorImage(p, m, (x, y) => [x, 159 - y]);
    }
    for (const o of [0, 1, 2, 3] as Orientation[]) {
      const p = piece('P', 'parallelogram', 48, [40, 56], { orientation: o });
      expectMirrorImage(p, mirrorY(p, 80, 'Q'), (x, y) => [x, 159 - y]);
    }
  });

  test('neo nhiễu được lật theo; hình tròn giữ hướng 0', () => {
    const p = piece('C1', 'circle', 48, [40, 56], { decoys: [[8, 0], [0, 8]] });
    const m = mirrorX(p, 64, 'C2');
    expect(m.id).toBe('C2');
    expect(m.orientation).toBe(0);
    expect(m.anchors).toEqual([
      { id: 'A', x: 64, y: 32 },
      { id: 'B', x: 56, y: 32 },
      { id: 'C', x: 64, y: 40 },
    ]);
  });

  test('cánh 2-2/2-3 của spec C: hướng 5 lật thành 7 tại gốc (0, 32)', () => {
    const wing = piece('T1', 'triangle', 96, [80, 80], { orientation: 5, decoys: [[-8, 0], [0, 8], [0, -8]] });
    expect(wing.anchors[0]).toEqual({ id: 'A', x: 32, y: 32 });
    const other = mirrorX(wing, 64, 'T2');
    expect(other.orientation).toBe(7);
    expect(other.anchors).toEqual([
      { id: 'A', x: 0, y: 32 },
      { id: 'B', x: 8, y: 32 },
      { id: 'C', x: 0, y: 40 },
      { id: 'D', x: 0, y: 24 },
    ]);
  });

  test('từ chối trục làm gốc khung lệch lưới', () => {
    const p = piece('P', 'square', 48, [40, 56]);
    expect(() => mirrorX(p, 62, 'Q')).toThrow(/không phải bội của 8/);
    expect(() => mirrorY(p, 81, 'Q')).toThrow(/không phải bội của 8/);
  });
});

describe('concentric và row', () => {
  test('concentric cho đúng gốc khung của mandala 3-10', () => {
    const pieces = concentric([64, 80], [
      { id: 'C1', kind: 'circle', size: 96, decoys: NUDGE },
      { id: 'S1', kind: 'square', size: 64 },
      { id: 'D1', kind: 'diamond', size: 64 },
      { id: 'C2', kind: 'circle', size: 32 },
      { id: 'K1', kind: 'diamond', size: 16 },
    ]);
    expect(pieces.map((p) => [p.id, p.anchors[0].x, p.anchors[0].y])).toEqual([
      ['C1', 16, 32],
      ['S1', 32, 48],
      ['D1', 32, 48],
      ['C2', 48, 64],
      ['K1', 56, 72],
    ]);
    expect(pieces[0].anchors.map((a) => a.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  test('row lặp theo bước, id <prefix>1..n', () => {
    const pieces = row('S', 'square', 32, [24, 40], [32, 0], 3, { decoys: [[0, 8]] });
    expect(pieces.map((p) => [p.id, p.anchors[0].x, p.anchors[0].y])).toEqual([
      ['S1', 8, 24],
      ['S2', 40, 24],
      ['S3', 72, 24],
    ]);
    expect(pieces[2].anchors[1]).toEqual({ id: 'B', x: 72, y: 32 });
    expect(() => row('S', 'square', 32, [24, 40], [32, 0], 0)).toThrow(/số nguyên ≥ 1/);
  });
});

describe('Hàm ghép hình ở chế độ đặt tự do (spec D mục 5)', () => {
  test('piece bỏ neo nhiễu khi placement là free', () => {
    const withDecoys = piece('S1', 'square', 48, [40, 64], { decoys: NUDGE });
    expect(withDecoys.anchors.length).toBeGreaterThan(1);
    const free = piece('S1', 'square', 48, [40, 64], { decoys: NUDGE, placement: 'free' });
    expect(free.anchors).toEqual([{ id: 'A', x: 16, y: 40 }]);
  });

  test('row và concentric cũng bỏ neo nhiễu', () => {
    const rowPieces = row('R', 'square', 48, [40, 64], [48, 0], 2, { decoys: CROSS, placement: 'free' });
    expect(rowPieces.map((p) => p.anchors)).toEqual([
      [{ id: 'A', x: 16, y: 40 }],
      [{ id: 'A', x: 64, y: 40 }],
    ]);
    const rings = concentric(
      [64, 80],
      [
        { id: 'S1', kind: 'square', size: 48, decoys: NUDGE },
        { id: 'D1', kind: 'diamond', size: 48, decoys: NUDGE },
      ],
      { placement: 'free' }
    );
    expect(rings.map((p) => p.anchors)).toEqual([
      [{ id: 'A', x: 40, y: 56 }],
      [{ id: 'A', x: 40, y: 56 }],
    ]);
  });
});
