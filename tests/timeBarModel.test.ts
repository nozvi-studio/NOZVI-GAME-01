import { computeLayout } from '../src/presentation/board/layout.ts';
import { describe, expect, test } from 'vitest';
import { starPolygon, timeBarModel, TIME_BAR } from '../src/presentation/hud/timeBarModel.ts';

describe('timeBarModel', () => {
  test('full at the start, empty past the budget', () => {
    expect(timeBarModel(0, 40_000).fill).toBe(1);
    expect(timeBarModel(40_000, 40_000).fill).toBe(0);
    expect(timeBarModel(90_000, 40_000).fill).toBe(0);
  });
  test('colour goes gold to orange at 70 % to red at 100 %', () => {
    expect(timeBarModel(0, 100).color).toBe(0xffc857);
    expect(timeBarModel(70, 100).color).toBe(0xff9f45);
    expect(timeBarModel(100, 100).color).toBe(0xff5d7a);
  });
  test('stars drop right-to-left at 15 / 45 / 75 %', () => {
    // index 0 is the left star (last to fall, 75 %), index 2 the right star (first, 15 %)
    expect(timeBarModel(14, 100).starsLeft).toEqual([true, true, true]);
    expect(timeBarModel(15, 100).starsLeft).toEqual([true, true, false]);
    expect(timeBarModel(45, 100).starsLeft).toEqual([true, false, false]);
    expect(timeBarModel(75, 100).starsLeft).toEqual([false, false, false]);
  });
  test('star slots sit at 25 / 55 / 85 % of the bar', () => {
    expect(TIME_BAR.starFractions).toEqual([0.25, 0.55, 0.85]);
  });
});

describe('starPolygon', () => {
  test('ten vertices, first one straight up', () => {
    const pts = starPolygon(0, 0, 10);
    expect(pts).toHaveLength(10);
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[0].y).toBeCloseTo(-10);
  });
});

test('timer and stars clear the target medallion on short and tall screens', () => {
  for (const height of [1280, 1560]) for (const top of [0, 48]) {
    const layout = computeLayout(720, height, { top, bottom: 0 });
    const starBottom = layout.headerBounds.y + TIME_BAR.centerY + TIME_BAR.starSize / 2 + 3;
    expect(starBottom).toBeLessThan(layout.targetBadgeY - 76);
    expect(TIME_BAR.subtitleY + 14).toBeLessThan(TIME_BAR.centerY - TIME_BAR.starSize / 2);
  }
});
