import { describe, expect, test } from 'vitest';
import { clipConvex, oddRegions, outlineChains, outlineLoops, parityLayers, parityOutline, polygonArea, unionOutline } from '../src/presentation/board/polygonClip.ts';
import type { Pt } from '../src/presentation/board/polygonClip.ts';
import { shapePolygon } from '../src/domain/shapes.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { computeLayout, piecePolygonCanvas } from '../src/presentation/board/layout.ts';

function square(x: number, y: number, s: number): Pt[] {
  return [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];
}

/** Điểm nằm hẳn bên trong đa giác lồi (không tính biên). */
function strictlyInside(polygon: readonly Pt[], p: Pt): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross === 0) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

describe('clipConvex', () => {
  test('hai hình vuông lệch nửa cạnh giao nhau một phần tư', () => {
    expect(polygonArea(clipConvex(square(0, 0, 10), square(5, 5, 10)))).toBeCloseTo(25, 9);
  });

  test('chỉ chạm cạnh hoặc rời nhau thì giao rỗng', () => {
    expect(clipConvex(square(0, 0, 10), square(10, 0, 10))).toEqual([]);
    expect(clipConvex(square(0, 0, 10), square(10, 10, 10))).toEqual([]);
    expect(clipConvex(square(0, 0, 10), square(30, 0, 10))).toEqual([]);
  });

  test('tam giác nằm trong hình vuông giữ nguyên diện tích', () => {
    const tri: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(clipConvex(tri, square(0, 0, 10)))).toBeCloseTo(50, 9);
  });

  test('không phụ thuộc chiều đi vòng của đa giác cắt', () => {
    const reversed = [...square(5, 5, 10)].reverse();
    expect(polygonArea(clipConvex(square(0, 0, 10), reversed))).toBeCloseTo(25, 9);
  });
});

describe('parityLayers', () => {
  test('hai hình giao nhau cho ba lớp: hai đơn và một cặp rỗng', () => {
    const layers = parityLayers([square(0, 0, 10), square(5, 0, 10)]);
    expect(layers.map((l) => [l.depth, l.filled])).toEqual([
      [1, true],
      [1, true],
      [2, false],
    ]);
  });

  test('lớp trên cùng tại mỗi điểm khớp tính chẵn lẻ của số mảnh phủ', () => {
    const polygons = [square(0, 0, 20), square(10, 0, 20), square(5, 8, 20)];
    const layers = parityLayers(polygons);
    for (let x = 0.37; x < 30; x += 1.3) {
      for (let y = 0.41; y < 30; y += 1.3) {
        const p = { x, y };
        const coverage = polygons.filter((poly) => strictlyInside(poly, p)).length;
        const top = [...layers].reverse().find((l) => strictlyInside(l.points, p));
        if (coverage === 0) {
          expect(top).toBeUndefined();
        } else {
          expect(top?.depth).toBe(coverage);
          expect(top?.filled).toBe(coverage % 2 === 1);
        }
      }
    }
  });

  test('bỏ qua đa giác suy biến', () => {
    const flat: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    expect(parityLayers([flat])).toEqual([]);
  });
});

describe('vùng giao hai hình tròn', () => {
  test('thấu kính của hai tròn khung 64 lệch tâm 32 gần đúng công thức hình tròn', () => {
    const a = shapePolygon('circle', 0, 64).map((p) => ({ x: p.x, y: p.y }));
    const b = a.map((p) => ({ x: p.x + 32, y: p.y }));
    const lens = polygonArea(clipConvex(a, b));
    const r = 32;
    const d = 32;
    const exact = 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
    // Đa giác 32 cạnh nội tiếp nhỏ hơn hình tròn thật: prototype đo được 1244,31 so với 1257,85 (1,08%)
    expect(lens).toBeCloseTo(1244.31, 1);
    expect(Math.abs(lens - exact) / exact).toBeLessThan(0.015);
  });
});

describe('unionOutline', () => {
  const squareRect = (x: number, y: number, w: number, h: number) => [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];

  test('a single square comes back as itself', () => {
    const loops = unionOutline([squareRect(0, 0, 10, 10)]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
  });

  test('two squares sharing a full edge become one 4-corner loop', () => {
    const loops = unionOutline([squareRect(0, 0, 10, 10), squareRect(0, 10, 10, 10)]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
    const ys = loops[0].map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[3]).toBe(20);
  });

  test('two squares sharing half an edge keep the exposed half', () => {
    const loops = unionOutline([squareRect(0, 0, 20, 10), squareRect(0, 10, 10, 10)]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(6);
  });

  test('a triangle on a square keeps only the house outline', () => {
    const body = squareRect(0, 10, 20, 20);
    const roof = [
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ];
    const loops = unionOutline([body, roof]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(5);

    // The seam the reviewer saw: the full span from (0,10) to (20,10) must not
    // survive as an edge of the result.
    const hasSeam = loops[0].some((p, i) => {
      const q = loops[0][(i + 1) % loops[0].length];
      return p.y === 10 && q.y === 10 && Math.abs(p.x - q.x) === 20;
    });
    expect(hasSeam).toBe(false);
  });

  test('two disjoint squares stay two loops', () => {
    const loops = unionOutline([squareRect(0, 0, 10, 10), squareRect(50, 50, 10, 10)]);
    expect(loops).toHaveLength(2);
  });

  test('ignores the winding direction of the inputs', () => {
    const cw = [...squareRect(0, 0, 10, 10)].reverse();
    const loops = unionOutline([cw, squareRect(0, 10, 10, 10)]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
  });

  test('all approved campaign levels produce valid union outline loops', () => {
    const layout = computeLayout(720, 1280);
    const approved = campaignManifest.filter((e) => e.status === 'approved');
    expect(approved.length).toBeGreaterThanOrEqual(17);
    for (const entry of approved) {
      const lvl = loadLevel(entry.id, 'campaign');
      const polygons = (lvl.targetPlacements ?? []).map((pl) => {
        const piece = lvl.pieces.find((p) => p.id === pl.pieceId)!;
        return piecePolygonCanvas(piece, pl.x, pl.y, pl.turns, layout);
      });
      const loops = unionOutline(polygons);
      expect(loops.length).toBeGreaterThanOrEqual(1);
      for (const loop of loops) {
        expect(loop.length).toBeGreaterThanOrEqual(3);
        for (const pt of loop) {
          expect(Number.isFinite(pt.x)).toBe(true);
          expect(Number.isFinite(pt.y)).toBe(true);
        }
      }
    }
  });
});

describe('parityOutline', () => {
  const square = (x: number, y: number, size: number) => [
    { x, y },
    { x: x + size, y },
    { x: x + size, y: y + size },
    { x, y: y + size },
  ];
  const length = (seg: readonly [{ x: number; y: number }, { x: number; y: number }]) =>
    Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);

  test('a single polygon is all of its edges', () => {
    expect(parityOutline([square(0, 0, 10)])).toHaveLength(4);
  });

  test('two identical polygons light nothing, so there is no outline', () => {
    expect(parityOutline([square(0, 0, 10), square(0, 0, 10)])).toHaveLength(0);
  });

  test('a half-overlap cancels the shared edges and keeps the rest', () => {
    // B is the left half of A: the lit region is the right half, bounded by 4 segments.
    const segments = parityOutline([square(0, 0, 10), [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }, { x: 0, y: 10 }]]);
    expect(segments).toHaveLength(4);
    expect(segments.reduce((sum, seg) => sum + length(seg), 0)).toBeCloseTo(5 + 10 + 5 + 10, 6);
  });

  test('crossing edges both stay: each flips the parity on its own', () => {
    const segments = parityOutline([square(0, 0, 10), square(5, 5, 10)]);
    expect(segments).toHaveLength(8);
    expect(segments.reduce((sum, seg) => sum + length(seg), 0)).toBeCloseTo(80, 6);
  });

  test('on every campaign level each segment lies between a lit and an unlit cell', () => {
    const layout = computeLayout(720, 1280);
    const inside = (poly: readonly Pt[], p: Pt) => {
      const sign = Math.sign(polygonArea(poly) && poly.reduce((sum, a, i) => {
        const b = poly[(i + 1) % poly.length];
        return sum + a.x * b.y - b.x * a.y;
      }, 0));
      return poly.every((a, i) => {
        const b = poly[(i + 1) % poly.length];
        return sign * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) >= 0;
      });
    };
    let checked = 0;
    for (const entry of campaignManifest) {
      let lvl;
      try {
        lvl = loadLevel(entry.id, 'campaign');
      } catch {
        continue;
      }
      const polygons = (lvl.targetPlacements ?? []).map((pl) => {
        const piece = lvl.pieces.find((p) => p.id === pl.pieceId)!;
        return piecePolygonCanvas(piece, pl.x, pl.y, pl.turns, layout);
      });
      if (polygons.length === 0) continue;
      const segments = parityOutline(polygons);
      expect(segments.length, entry.id).toBeGreaterThan(0);
      const lit = (p: Pt) => polygons.filter((poly) => inside(poly, p)).length % 2 === 1;
      for (const [a, b] of segments) {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        expect(Number.isFinite(len), entry.id).toBe(true);
        const nx = -(b.y - a.y) / len;
        const ny = (b.x - a.x) / len;
        // Several samples: a joined segment can pass through a touching vertex at its middle.
        for (const t of [0.13, 0.37, 0.61, 0.87]) {
          const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          const one = lit({ x: at.x + nx * 0.5, y: at.y + ny * 0.5 });
          const other = lit({ x: at.x - nx * 0.5, y: at.y - ny * 0.5 });
          expect(one !== other, `${entry.id} segment ${JSON.stringify([a, b])} at ${t}`).toBe(true);
        }
      }
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(17);
  });
});

describe('oddRegions', () => {
  const area = (rs: readonly (readonly Pt[])[]) => rs.reduce((s, r) => s + polygonArea(r), 0);

  test('two overlapping squares: even overlap is removed', () => {
    const regions = oddRegions([square(0, 0, 10), square(5, 5, 10)]);
    expect(area(regions)).toBeCloseTo(100 + 100 - 2 * 25, 6);
  });

  test('three stacked squares: odd depth is lit again, area matches parity', () => {
    const regions = oddRegions([square(0, 0, 10), square(0, 0, 10), square(0, 0, 10)]);
    expect(area(regions)).toBeCloseTo(100, 6);
    expect(oddRegions([square(0, 0, 10), square(0, 0, 10)])).toEqual([]);
  });

  test('matches the parity layers on level 2-20 (triangles and diamonds)', () => {
    const polys = [
      [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }],
      [{ x: 10, y: -5 }, { x: 30, y: 15 }, { x: 10, y: 25 }, { x: -10, y: 15 }],
      [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 15, y: 25 }],
    ];
    const expected = parityLayers(polys).reduce((s, l) => s + (-2) ** (l.depth - 1) * polygonArea(l.points), 0);
    expect(area(oddRegions(polys))).toBeCloseTo(expected, 6);
  });
});

describe('outlineLoops', () => {
  test('a single polygon is one closed loop', () => {
    const loops = outlineLoops(parityOutline([square(0, 0, 10)]));
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
  });

  test('disjoint polygons give one loop each', () => {
    expect(outlineLoops(parityOutline([square(0, 0, 10), square(30, 0, 10)]))).toHaveLength(2);
  });

  test('overlapping squares keep only the outer and the hole boundary, no edge inside the hole', () => {
    const loops = outlineLoops(parityOutline([square(0, 0, 10), square(5, 5, 10)]));
    const used = loops.reduce((n, l) => n + l.length, 0);
    expect(used).toBe(parityOutline([square(0, 0, 10), square(5, 5, 10)]).length);
    for (const loop of loops) for (const p of loop) expect(Number.isFinite(p.x + p.y)).toBe(true);
  });
});

describe('parityOutline outerOnly', () => {
  test('keeps the outside edge of overlapping squares and drops the edge of the removed overlap', () => {
    const polys = [square(0, 0, 10), square(5, 5, 10)];
    const outer = parityOutline(polys, true);
    const loops = outlineLoops(outer);
    expect(loops).toHaveLength(1);
    expect(polygonArea(loops[0])).toBeCloseTo(175, 6);
  });

  test('keeps every edge when nothing overlaps', () => {
    const polys = [square(0, 0, 10), square(30, 0, 10)];
    expect(parityOutline(polys, true)).toHaveLength(parityOutline(polys).length);
  });

  test('two squares sharing a side form one outline', () => {
    const polys = [square(0, 0, 10), square(10, 0, 10)];
    expect(outlineLoops(parityOutline(polys, true))).toHaveLength(1);
  });
});

describe('outlineChains', () => {
  test('a closed outline comes back as one closed chain', () => {
    const chains = outlineChains(parityOutline([square(0, 0, 10)]));
    expect(chains).toHaveLength(1);
    expect(chains[0].closed).toBe(true);
    expect(chains[0].points).toHaveLength(4);
  });

  test('segments that do not meet back up stay open and keep every point', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    const c = { x: 10, y: 10 };
    const d = { x: 20, y: 10 };
    const chains = outlineChains([[b, c], [a, b], [c, d]]);
    expect(chains).toHaveLength(1);
    expect(chains[0].closed).toBe(false);
    expect(chains[0].points).toHaveLength(4);
    const xs = chains[0].points.map((p) => p.x);
    expect(xs[0] === 0 || xs[0] === 20).toBe(true);
  });
});

describe('parityOutline outerOnly keeps only lit-to-empty edges', () => {
  // Two triangles sharing the apex, the small one inside the big one (level 2-19's shape):
  // between them is a thin lit band; the inner triangle is removed where a third piece covers it.
  test('an edge between a removed area and the empty board is not drawn', () => {
    const big: Pt[] = [{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }];
    const same: Pt[] = [{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }];
    const third: Pt[] = [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 10, y: 20 }];
    // big and `same` cover the up-triangle twice (removed); `third` is lit below it.
    const outer = parityOutline([big, same, third], true);
    for (const [a, b] of outer) {
      const onSlope = (p: Pt) => p.y < 10;
      expect(onSlope(a) && onSlope(b)).toBe(false);
    }
    expect(outer.length).toBeGreaterThan(0);
  });
});
