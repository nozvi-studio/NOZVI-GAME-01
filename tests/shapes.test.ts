import { describe, expect, test } from 'vitest';
import {
  CIRCLE_SEGMENTS,
  effectiveOrientation,
  isStructuralFrame,
  isValidFrame,
  isValidOrientation,
  mirrorOrientation,
  shapeCells,
  shapePolygon,
} from '../src/domain/shapes.ts';
import type { Vertex } from '../src/domain/shapes.ts';
import { rotateCells } from '../src/domain/geometry.ts';
import type { Cell, Orientation } from '../src/domain/model.ts';

const S = 48;
const key = ([x, y]: Cell): string => `${x},${y}`;

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

function placed(cells: Cell[], ox: number, oy: number): Set<string> {
  return new Set(cells.map(([x, y]) => `${ox + x},${oy + y}`));
}

describe('shapePolygon theo bảng đỉnh của spec', () => {
  test('vuông và thoi', () => {
    expect(shapePolygon('square', 0, S)).toEqual([
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 48 },
      { x: 0, y: 48 },
    ]);
    expect(shapePolygon('diamond', 0, S)).toEqual([
      { x: 24, y: 0 },
      { x: 48, y: 24 },
      { x: 24, y: 48 },
      { x: 0, y: 24 },
    ]);
  });

  test('tam giác góc BL và mái hướng 4', () => {
    expect(shapePolygon('triangle', 3, S)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 48 },
      { x: 48, y: 48 },
    ]);
    expect(shapePolygon('triangle', 4, S)).toEqual([
      { x: 0, y: 48 },
      { x: 48, y: 48 },
      { x: 24, y: 24 },
    ]);
  });
});

describe('rasterize theo quy tắc ô biên trên-trái', () => {
  test('số ô từng hình ở khung 48', () => {
    expect(shapeCells('square', 0, S)).toHaveLength(2304);
    expect(shapeCells('diamond', 0, S)).toHaveLength(1152);
    const triangleCounts = ([0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]).map(
      (o) => shapeCells('triangle', o, S).length
    );
    expect(triangleCounts).toEqual([1128, 1176, 1176, 1128, 576, 552, 576, 600]);
  });

  test('mọi ô nằm trong khung', () => {
    for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) {
      for (const [x, y] of shapeCells('triangle', o, S)) {
        expect(x >= 0 && x < S && y >= 0 && y < S).toBe(true);
      }
    }
  });

  test('hai tam giác bù nhau lát kín khung, không trùng ô', () => {
    for (const [a, b] of [
      [0, 2],
      [1, 3],
    ] as Array<[Orientation, Orientation]>) {
      const first = new Set(shapeCells('triangle', a, S).map(key));
      const second = shapeCells('triangle', b, S).map(key);
      expect(second.filter((k) => first.has(k))).toHaveLength(0);
      expect(first.size + second.length).toBe(S * S);
    }
  });

  test('thoi và hai cánh của 1-6 chung cạnh nhưng không chung ô', () => {
    const w1 = placed(shapeCells('triangle', 3, S), 16, 56);
    const w2 = placed(shapeCells('triangle', 2, S), 64, 56);
    const d1 = placed(shapeCells('diamond', 0, S), 40, 56);
    for (const k of d1) {
      expect(w1.has(k)).toBe(false);
      expect(w2.has(k)).toBe(false);
    }
  });
});

describe('xoay', () => {
  test('effectiveOrientation quay vòng trong cùng họ', () => {
    expect([0, 1, 2, 3].map((t) => effectiveOrientation('triangle', 0, t))).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((t) => effectiveOrientation('triangle', 3, t))).toEqual([3, 0, 1, 2]);
    expect([0, 1, 2, 3].map((t) => effectiveOrientation('triangle', 6, t))).toEqual([6, 7, 4, 5]);
    expect(effectiveOrientation('diamond', 0, 3)).toBe(0);
    expect(effectiveOrientation('square', 0, 1)).toBe(0);
  });

  test('rotateCells và raster hướng hiệu dụng chỉ khác ở ô có tâm nằm trên viền', () => {
    for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) {
      for (const t of [1, 2, 3]) {
        const rotated = new Set(rotateCells(shapeCells('triangle', o, S), S, t).map(key));
        const eff = effectiveOrientation('triangle', o, t);
        const direct = new Set(shapeCells('triangle', eff, S).map(key));
        const polygon = shapePolygon('triangle', eff, S);
        const diff = [
          ...[...rotated].filter((k) => !direct.has(k)),
          ...[...direct].filter((k) => !rotated.has(k)),
        ];
        expect(diff.length).toBeLessThanOrEqual(S);
        for (const k of diff) {
          const [x, y] = k.split(',').map(Number);
          expect(onOutline(polygon, x + 0.5, y + 0.5)).toBe(true);
        }
      }
    }
  });
});

describe('isValidOrientation', () => {
  test('tam giác nhận 0–7, vuông và thoi chỉ nhận 0', () => {
    expect(isValidOrientation('triangle', 7)).toBe(true);
    expect(isValidOrientation('triangle', 8)).toBe(false);
    expect(isValidOrientation('triangle', 1.5)).toBe(false);
    expect(isValidOrientation('square', 0)).toBe(true);
    expect(isValidOrientation('square', 1)).toBe(false);
    expect(isValidOrientation('diamond', 2)).toBe(false);
  });
});

describe('hình tròn và hình bình hành (spec A)', () => {
  test('hình tròn là đa giác đều 32 cạnh nội tiếp khung', () => {
    const poly = shapePolygon('circle', 0, 64);
    expect(CIRCLE_SEGMENTS).toBe(32);
    expect(poly).toHaveLength(32);
    expect(poly[0].x).toBeCloseTo(64, 9);
    expect(poly[0].y).toBeCloseTo(32, 9);
    for (const p of poly) {
      expect(Math.hypot(p.x - 32, p.y - 32)).toBeCloseTo(32, 9);
    }
  });

  test('số ô hình tròn khung 16/32/64 (số tính bằng prototype)', () => {
    expect(shapeCells('circle', 0, 16)).toHaveLength(208);
    expect(shapeCells('circle', 0, 32)).toHaveLength(812);
    expect(shapeCells('circle', 0, 64)).toHaveLength(3196);
  });

  test('bình hành khung 48 theo bảng đỉnh và 512 ô mỗi hướng', () => {
    expect(shapePolygon('parallelogram', 0, 48)).toEqual([
      { x: 16, y: 16 },
      { x: 48, y: 16 },
      { x: 32, y: 32 },
      { x: 0, y: 32 },
    ]);
    expect(shapePolygon('parallelogram', 3, 48)).toEqual([
      { x: 32, y: 0 },
      { x: 32, y: 32 },
      { x: 16, y: 48 },
      { x: 16, y: 16 },
    ]);
    for (const o of [0, 1, 2, 3] as Orientation[]) {
      expect(shapeCells('parallelogram', o, 48)).toHaveLength(512);
    }
  });

  test('bình hành 0 và 2 là ảnh gương; chỉ khác ở ô có tâm trên viền', () => {
    const mirrored = new Set(shapeCells('parallelogram', 0, S).map(([x, y]) => `${S - 1 - x},${y}`));
    const direct = new Set(shapeCells('parallelogram', 2, S).map(key));
    const polygon = shapePolygon('parallelogram', 2, S);
    const diff = [
      ...[...mirrored].filter((k) => !direct.has(k)),
      ...[...direct].filter((k) => !mirrored.has(k)),
    ];
    expect(diff).toHaveLength(32);
    for (const k of diff) {
      const [x, y] = k.split(',').map(Number);
      expect(onOutline(polygon, x + 0.5, y + 0.5)).toBe(true);
    }
  });

  test('xoay bình hành: hướng hiệu dụng quay vòng trong họ, chỉ khác ô trên viền', () => {
    expect([0, 1, 2, 3].map((t) => effectiveOrientation('parallelogram', 0, t))).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3].map((t) => effectiveOrientation('parallelogram', 3, t))).toEqual([3, 2, 3, 2]);
    const rotated = new Set(rotateCells(shapeCells('parallelogram', 0, S), S, 1).map(key));
    const direct = new Set(shapeCells('parallelogram', 1, S).map(key));
    const polygon = shapePolygon('parallelogram', 1, S);
    const diff = [
      ...[...rotated].filter((k) => !direct.has(k)),
      ...[...direct].filter((k) => !rotated.has(k)),
    ];
    expect(diff).toHaveLength(32);
    for (const k of diff) {
      const [x, y] = k.split(',').map(Number);
      expect(onOutline(polygon, x + 0.5, y + 0.5)).toBe(true);
    }
  });

  test('hình tròn bất biến khi xoay', () => {
    expect(effectiveOrientation('circle', 0, 3)).toBe(0);
    const cells = shapeCells('circle', 0, 64);
    const rotated = new Set(rotateCells(cells, 64, 1).map(key));
    expect(rotated.size).toBe(cells.length);
    for (const c of cells) expect(rotated.has(key(c))).toBe(true);
  });

  test('isValidOrientation cho hai hình mới', () => {
    expect(isValidOrientation('circle', 0)).toBe(true);
    expect(isValidOrientation('circle', 1)).toBe(false);
    expect(isValidOrientation('parallelogram', 3)).toBe(true);
    expect(isValidOrientation('parallelogram', 4)).toBe(false);
  });
});

describe('quy tắc khung và lật gương', () => {
  test('isValidFrame đúng bảng bám lưới của spec A mục 3', () => {
    expect(isValidFrame('square', 0, 24)).toBe(true);
    expect(isValidFrame('square', 0, 12)).toBe(false);
    expect(isValidFrame('triangle', 0, 24)).toBe(true);
    expect(isValidFrame('triangle', 4, 24)).toBe(false);
    expect(isValidFrame('triangle', 4, 32)).toBe(true);
    expect(isValidFrame('diamond', 0, 24)).toBe(false);
    expect(isValidFrame('diamond', 0, 48)).toBe(true);
    expect(isValidFrame('circle', 0, 16)).toBe(true);
    expect(isValidFrame('circle', 0, 40)).toBe(false);
    expect(isValidFrame('parallelogram', 0, 24)).toBe(true);
    expect(isValidFrame('parallelogram', 0, 48)).toBe(true);
    expect(isValidFrame('parallelogram', 0, 32)).toBe(false);
    expect(isValidFrame('parallelogram', 0, 72)).toBe(true);
    expect(isValidFrame('parallelogram', 0, 96)).toBe(true);
    expect(isValidFrame('square', 0, 136)).toBe(false);
  });

  test('isStructuralFrame chỉ đòi đỉnh nguyên và khung vừa bàn', () => {
    // Fixture kỹ thuật M0 dùng thoi khung 40: hợp lệ về cấu trúc dù không bám lưới
    expect(isStructuralFrame('diamond', 0, 40)).toBe(true);
    expect(isStructuralFrame('diamond', 0, 25)).toBe(false);
    expect(isStructuralFrame('circle', 0, 15)).toBe(false);
    expect(isStructuralFrame('parallelogram', 0, 32)).toBe(false);
    expect(isStructuralFrame('parallelogram', 0, 45)).toBe(true);
    expect(isStructuralFrame('square', 0, 129)).toBe(false);
  });

  test('mirrorOrientation theo bảng của spec A và B', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((o) => mirrorOrientation('triangle', o as Orientation, 'x'))).toEqual([1, 0, 3, 2, 4, 7, 6, 5]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((o) => mirrorOrientation('triangle', o as Orientation, 'y'))).toEqual([3, 2, 1, 0, 6, 5, 4, 7]);
    expect([0, 1, 2, 3].map((o) => mirrorOrientation('parallelogram', o as Orientation, 'x'))).toEqual([2, 3, 0, 1]);
    expect([0, 1, 2, 3].map((o) => mirrorOrientation('parallelogram', o as Orientation, 'y'))).toEqual([2, 3, 0, 1]);
    expect(mirrorOrientation('circle', 0, 'x')).toBe(0);
    expect(mirrorOrientation('diamond', 0, 'y')).toBe(0);
  });

  test('lật gương tam giác theo trục dọc khớp tập ô (trừ ô trên viền)', () => {
    for (const o of [0, 1, 2, 3, 4, 5, 6, 7] as Orientation[]) {
      const m = mirrorOrientation('triangle', o, 'x');
      const mirrored = new Set(shapeCells('triangle', o, S).map(([x, y]) => `${S - 1 - x},${y}`));
      const direct = new Set(shapeCells('triangle', m, S).map(key));
      const polygon = shapePolygon('triangle', m, S);
      for (const k of [...mirrored].filter((c) => !direct.has(c))) {
        const [x, y] = k.split(',').map(Number);
        expect(onOutline(polygon, x + 0.5, y + 0.5)).toBe(true);
      }
    }
  });
});
