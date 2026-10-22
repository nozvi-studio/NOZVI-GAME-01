import { describe, expect, test } from 'vitest';
import { formatStarTotal, nodeStarRow, starTotals, STARS_PER_LEVEL } from '../src/presentation/galaxy/levelStars.ts';

const manifest = [
  { id: '1-1', chapter: 1 },
  { id: '1-2', chapter: 1 },
  { id: '2-1', chapter: 2 },
];

describe('starTotals', () => {
  test('sums the best stars against three per level', () => {
    const levels = { '1-1': { stars: 3 }, '1-2': { stars: 1 }, '2-1': { stars: 2 } } as const;
    expect(starTotals(manifest, levels)).toEqual({ earned: 6, max: 3 * STARS_PER_LEVEL });
  });

  test('narrows to one chapter', () => {
    const levels = { '1-1': { stars: 3 }, '2-1': { stars: 2 } } as const;
    expect(starTotals(manifest, levels, 1)).toEqual({ earned: 3, max: 6 });
    expect(starTotals(manifest, levels, 2)).toEqual({ earned: 2, max: 3 });
  });

  test('ignores results for ids outside the manifest and counts missing results as zero', () => {
    expect(starTotals(manifest, { '9-9': { stars: 3 } })).toEqual({ earned: 0, max: 9 });
  });
});

describe('nodeStarRow', () => {
  test('lights stars left to right', () => {
    expect(nodeStarRow(0).map((s) => s.lit)).toEqual([false, false, false]);
    expect(nodeStarRow(2).map((s) => s.lit)).toEqual([true, true, false]);
    expect(nodeStarRow(3).map((s) => s.lit)).toEqual([true, true, true]);
  });

  test('middle star is larger and sits higher, side stars mirror each other', () => {
    const [left, middle, right] = nodeStarRow(1);
    expect(middle.outer).toBeGreaterThan(left.outer);
    expect(middle.dy).toBeLessThan(left.dy);
    expect(middle.dx).toBe(0);
    expect(left.dx).toBe(-right.dx);
    expect(left.outer).toBe(right.outer);
  });
});

describe('formatStarTotal', () => {
  test('reads earned over max', () => {
    expect(formatStarTotal({ earned: 96, max: 144 })).toBe('96/144');
  });
});
