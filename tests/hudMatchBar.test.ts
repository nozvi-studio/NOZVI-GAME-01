import { describe, expect, it } from 'vitest';
import { computeMatchBarLayout } from '../src/presentation/hud/matchBarLayout.ts';

describe('match bar placement between bottom actions', () => {
  it.each([
    [2, false, 364], [7, false, 551.2], [10, false, 551.2],
    [2, true, 364], [7, true, 288], [10, true, 288],
  ] as const)('fits %s pieces (rotate=%s) without covering an action', (total, rotate, width) => {
    const right = rotate ? 575.2 : 696;
    const bar = computeMatchBarLayout(total, 240, 144.8, right);
    expect(bar.width).toBeCloseTo(width);
    expect(bar.centerX).toBeCloseTo(rotate ? 360 : 420.4);
    expect(bar.centerX - bar.width / 2).toBeGreaterThanOrEqual(144.8 - 1e-8);
    expect(bar.centerX + bar.width / 2).toBeLessThanOrEqual(right + 1e-8);
    expect(bar.iconCenters).toHaveLength(rotate && total >= 7 ? 0 : total);
    for (const cx of bar.iconCenters) {
      expect(cx - bar.iconSize).toBeGreaterThanOrEqual(-bar.width / 2 + 24 - 1e-8);
      expect(cx + bar.iconSize).toBeLessThan(bar.textX);
    }
    expect(bar.textX + 240 * bar.textScale).toBeCloseTo(bar.width / 2 - 24);
  });

  it('compacts jewels before hiding them', () => {
    const bar = computeMatchBarLayout(7, 240, 144.8, 696);
    expect(bar.iconSize).toBeGreaterThanOrEqual(9);
    expect(bar.iconSize).toBeLessThan(14);
    expect(bar.iconGap).toBeGreaterThanOrEqual(6);
    expect(bar.iconGap).toBeLessThan(10);
  });

  it('clears animation centers and fits long localized text when jewels cannot fit', () => {
    const bar = computeMatchBarLayout(10, 600, 144.8, 575.2);
    expect(bar.iconCenters).toEqual([]);
    expect(bar.width).toBeCloseTo(430.4);
    expect(bar.textScale).toBeCloseTo(382.4 / 600);
    expect(bar.textX).toBeCloseTo(-191.2);
  });
});

