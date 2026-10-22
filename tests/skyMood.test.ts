import { describe, expect, test } from 'vitest';
import { SKY_MOODS, advanceDrift } from '../src/presentation/sky/skyMood.ts';

describe('mood bầu trời', () => {
  test('ba mood theo spec F1 mục 2.1', () => {
    expect(SKY_MOODS).toEqual({
      menu: { driftSpeed: 0, dim: 0 },
      map: { driftSpeed: 1, dim: 0 },
      play: { driftSpeed: 0, dim: 0.35 },
    });
  });

  test('quãng trôi cộng dồn theo tốc độ, không nhảy khi đổi tốc độ', () => {
    let d = 0;
    d = advanceDrift(d, 1000, 1);
    expect(d).toBe(1000);
    d = advanceDrift(d, 1000, 0.5);
    expect(d).toBe(1500);
    d = advanceDrift(d, 1000, 0);
    expect(d).toBe(1500);
  });

  test('tốc độ âm coi như đứng yên', () => {
    expect(advanceDrift(10, 100, -1)).toBe(10);
  });
});
