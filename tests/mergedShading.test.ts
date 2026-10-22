import { describe, expect, test } from 'vitest';
import { clipConvex, oddRegions, polygonArea } from '../src/presentation/board/polygonClip.ts';
import type { Pt } from '../src/presentation/board/polygonClip.ts';
import {
  gradientColor,
  regionBounds,
  shadeStrips,
  sheenBand,
  sparkleSpots,
  twinkle,
} from '../src/presentation/board/mergedShading.ts';

const square = (x: number, y: number, s: number): Pt[] => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];
const diamond = (cx: number, cy: number, r: number): Pt[] => [
  { x: cx, y: cy - r },
  { x: cx + r, y: cy },
  { x: cx, y: cy + r },
  { x: cx - r, y: cy },
];

const regions = oddRegions([square(0, 0, 60), square(40, 40, 60)]);
const area = (rs: readonly (readonly Pt[])[]) => rs.reduce((s, r) => s + polygonArea(r), 0);

describe('shadeStrips', () => {
  test('the strips cover exactly the regions, no gap and no overlap', () => {
    const strips = shadeStrips(regions, 7);
    expect(area(strips.map((s) => s.points))).toBeCloseTo(area(regions), 4);
    expect(strips.length).toBeGreaterThan(regions.length);
  });

  test('t runs from light to dark across the figure', () => {
    const ts = shadeStrips(regions, 7).map((s) => s.t);
    expect(Math.min(...ts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ts)).toBeLessThanOrEqual(1);
    expect(Math.max(...ts) - Math.min(...ts)).toBeGreaterThan(0.6);
  });
});

describe('shadeStrips with shared bounds', () => {
  test('a part of the figure shades the same as inside the whole', () => {
    const whole = shadeStrips(regions, 7);
    const bounds = regionBounds(regions);
    const part = shadeStrips([regions[0]], 7, bounds);
    const first = whole.find((w) => Math.abs(w.points[0].y - part[0].points[0].y) < 1e-6 && Math.abs(w.points[0].x - part[0].points[0].x) < 1e-6);
    expect(first?.t).toBeCloseTo(part[0].t, 9);
  });
});

describe('gradientColor', () => {
  test('light at 0, dark at 1, clamped outside', () => {
    expect(gradientColor(0)).toBe(0xffeaa8);
    expect(gradientColor(1)).toBe(0xefa53a);
    expect(gradientColor(-3)).toBe(gradientColor(0));
    expect(gradientColor(9)).toBe(gradientColor(1));
  });
});

describe('sheenBand', () => {
  const b = regionBounds(regions);

  test('a band in the middle of the sweep lights part of the figure', () => {
    const band = sheenBand(b, 0.5, 0.15);
    const lit = area(regions.map((r) => clipConvex(r, band)));
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(area(regions));
  });

  test('before and after the sweep nothing is lit', () => {
    for (const p of [-0.3, 1.3]) {
      const band = sheenBand(b, p, 0.15);
      expect(area(regions.map((r) => clipConvex(r, band)))).toBeCloseTo(0, 6);
    }
  });
});

describe('sparkles', () => {
  test('a few spots inside the figure, spread apart, each with a light-axis position', () => {
    const spots = sparkleSpots([diamond(0, 0, 40), diamond(80, 0, 40), diamond(40, 70, 40)], 3);
    expect(spots).toHaveLength(3);
    for (const s of spots) {
      expect(s.u).toBeGreaterThanOrEqual(0);
      expect(s.u).toBeLessThanOrEqual(1);
    }
    expect(new Set(spots.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`)).size).toBe(3);
  });

  test('never more spots than regions', () => {
    expect(sparkleSpots([diamond(0, 0, 40)], 5)).toHaveLength(1);
    expect(sparkleSpots([], 5)).toEqual([]);
  });

  test('twinkle peaks when the sheen is on the spot and dies away from it', () => {
    expect(twinkle(0.5, 0.5)).toBe(1);
    expect(twinkle(0.5, 0.6)).toBeGreaterThan(0);
    expect(twinkle(0.5, 0.6)).toBeLessThan(1);
    expect(twinkle(0.5, 0.95)).toBe(0);
  });
});
