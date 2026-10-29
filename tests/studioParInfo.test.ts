import { describe, expect, it } from 'vitest';
import { formatSeconds, parInfo } from '../src/studio/parInfo.ts';

describe('parInfo', () => {
  it('derives the budget and star windows from par', () => {
    const info = parInfo(2000, 2);
    expect(info.parMs).toBe(2000);
    expect(info.budgetMs).toBe(13_500);
    expect(info.starWindowsMs[0]).toBeCloseTo(2025, 0);
    expect(info.starWindowsMs[1]).toBeCloseTo(6075, 0);
    expect(info.starWindowsMs[2]).toBeCloseTo(10_125, 0);
  });

  it('keeps scaling with par instead of capping the budget', () => {
    const info = parInfo(16_000, 4);
    expect(info.budgetMs).toBe(114_000);
    expect(info.starWindowsMs[0]).toBeCloseTo(17_100, 0);
  });

  it('formats seconds with one decimal', () => {
    expect(formatSeconds(3000)).toBe('3.0s');
    expect(formatSeconds(15000)).toBe('15.0s');
  });
});
