import { describe, expect, test } from 'vitest';
import {
  parFromSolution,
  STAR_PERCENTS,
  starsFor,
  THREE_STAR_PAR_RATIO,
  timeBudget,
} from '../src/domain/starRating.ts';

describe('parFromSolution', () => {
  test('counts pieces and turns', () => {
    expect(parFromSolution([{ turns: 0 }, { turns: 0 }])).toBe(4000 + 2 * 2500);
    expect(parFromSolution([{ turns: 2 }, { turns: 1 }, { turns: 0 }])).toBe(4000 + 3 * 2500 + 3 * 1200);
  });
  test('an empty solution is just the base', () => {
    expect(parFromSolution([])).toBe(4000);
  });
});

describe('timeBudget', () => {
  test('3-star window is par x THREE_STAR_PAR_RATIO', () => {
    expect(timeBudget(4000)).toBe(33_333);
    expect(timeBudget(16_000)).toBe(133_333);
  });
  test('the 3-star window grows with par instead of hitting a ceiling', () => {
    const window3 = (par: number) => (timeBudget(par) * STAR_PERCENTS[0]) / 100;
    expect(window3(9000)).toBeCloseTo(9000 * THREE_STAR_PAR_RATIO, -1);
    expect(window3(22_000)).toBeCloseTo(22_000 * THREE_STAR_PAR_RATIO, -1);
    expect(window3(22_000)).toBeGreaterThan(window3(9000));
  });
  test('a solver at par earns 3 stars on a 4-piece level', () => {
    const par = parFromSolution([{ turns: 0 }, { turns: 0 }, { turns: 0 }, { turns: 0 }]);
    expect(starsFor(par, timeBudget(par))).toBe(3);
  });
});

describe('starsFor', () => {
  const budget = 40_000; // 15 % = 6000, 45 % = 18000, 75 % = 30000
  test.each([
    [0, 3],
    [5999, 3],
    [6000, 2],
    [17_999, 2],
    [18_000, 1],
    [29_999, 1],
    [30_000, 0],
    [200_000, 0],
  ])('elapsed %i ms -> %i stars', (elapsed, stars) => {
    expect(starsFor(elapsed, budget)).toBe(stars);
  });
});
