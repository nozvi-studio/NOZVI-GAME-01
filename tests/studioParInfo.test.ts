import { describe, expect, it } from 'vitest';
import { formatSeconds, parInfo } from '../src/studio/parInfo.ts';

describe('parInfo', () => {
  it('clamps the budget to the minimum and derives star windows', () => {
    expect(parInfo(2000)).toEqual({ parMs: 2000, budgetMs: 20000, starWindowsMs: [3000, 9000, 15000] });
  });

  it('clamps the budget to the maximum', () => {
    expect(parInfo(10000)).toEqual({ parMs: 10000, budgetMs: 45000, starWindowsMs: [6750, 20250, 33750] });
  });

  it('formats seconds with one decimal', () => {
    expect(formatSeconds(3000)).toBe('3.0s');
    expect(formatSeconds(15000)).toBe('15.0s');
  });
});
