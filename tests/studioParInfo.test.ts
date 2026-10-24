import { describe, expect, it } from 'vitest';
import { formatSeconds, parInfo } from '../src/studio/parInfo.ts';

describe('parInfo', () => {
  it('derives the budget and star windows from par', () => {
    const info = parInfo(2000);
    expect(info.parMs).toBe(2000);
    expect(info.budgetMs).toBe(16_667);
    expect(info.starWindowsMs[0]).toBeCloseTo(2500, 0);
    expect(info.starWindowsMs[1]).toBeCloseTo(7500, 0);
    expect(info.starWindowsMs[2]).toBeCloseTo(12_500, 0);
  });

  it('keeps scaling with par instead of capping the budget', () => {
    const info = parInfo(16_000);
    expect(info.budgetMs).toBe(133_333);
    expect(info.starWindowsMs[0]).toBeCloseTo(20_000, 0);
  });

  it('formats seconds with one decimal', () => {
    expect(formatSeconds(3000)).toBe('3.0s');
    expect(formatSeconds(15000)).toBe('15.0s');
  });
});
