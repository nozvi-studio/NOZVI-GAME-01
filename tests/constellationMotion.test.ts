import { describe, expect, test } from 'vitest';
import { constellationPath, parallaxOffset, victoryGlow, walkedLinkAlpha } from '../src/presentation/galaxy/constellationMotion.ts';

describe('constellation motion', () => {
  test('level route bends away from the straight chord while preserving endpoints', () => {
    const points = constellationPath({ x: 220, y: 270 }, { x: 500, y: 430 });
    expect(points[0]).toEqual({ x: 220, y: 270 });
    expect(points.at(-1)).toEqual({ x: 500, y: 430 });
    expect(Math.abs(points[6].x - 360)).toBeGreaterThan(25);
  });

  test('ambient stars follow scroll at a slower rate than level nodes', () => {
    expect(parallaxOffset(-600)).toBe(210);
    expect(parallaxOffset(0)).toBe(0);
  });

  test('victory light rises sharply and fully disappears', () => {
    expect(victoryGlow(0)).toBe(0);
    expect(victoryGlow(0.32)).toBeGreaterThan(0.9);
    expect(victoryGlow(1)).toBe(0);
  });
});

describe('walked link emphasis', () => {
  test('the link into the current node stays brighter than the rest', () => {
    expect(walkedLinkAlpha(true)).toBeGreaterThan(walkedLinkAlpha(false));
  });

  test('both stay below the current node, which owns tier 3', () => {
    expect(walkedLinkAlpha(true)).toBeLessThan(1);
    expect(walkedLinkAlpha(false)).toBeLessThan(walkedLinkAlpha(true));
  });
});
