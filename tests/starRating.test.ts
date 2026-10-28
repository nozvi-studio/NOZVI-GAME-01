import { describe, expect, test } from 'vitest';
import {
  parFromSolution,
  STAR_PERCENTS,
  starsFor,
  THREE_STAR_PAR_RATIO,
  threeStarRatio,
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
  test('3-star window is par x the ratio for the piece count', () => {
    expect(timeBudget(4000, 4)).toBe(28_500);
    expect(timeBudget(16_000, 4)).toBe(114_000);
    expect(timeBudget(4000, 2)).toBe(27_000);
  });
  test('levels up to 3 pieces are tightened by 10 %, bigger ones by 5 %, on top of the base ratio', () => {
    expect(threeStarRatio(1)).toBeCloseTo(THREE_STAR_PAR_RATIO * 0.9, 10);
    expect(threeStarRatio(3)).toBeCloseTo(THREE_STAR_PAR_RATIO * 0.9, 10);
    expect(threeStarRatio(4)).toBeCloseTo(THREE_STAR_PAR_RATIO * 0.95, 10);
    expect(threeStarRatio(8)).toBeCloseTo(THREE_STAR_PAR_RATIO * 0.95, 10);
  });
  test('the 3-star window grows with par instead of hitting a ceiling', () => {
    const window3 = (par: number) => (timeBudget(par, 4) * STAR_PERCENTS[0]) / 100;
    expect(window3(9000)).toBeCloseTo(9000 * threeStarRatio(4), -1);
    expect(window3(22_000)).toBeCloseTo(22_000 * threeStarRatio(4), -1);
    expect(window3(22_000)).toBeGreaterThan(window3(9000));
  });
  test('a solver at par earns 3 stars on a 4-piece level', () => {
    const par = parFromSolution([{ turns: 0 }, { turns: 0 }, { turns: 0 }, { turns: 0 }]);
    expect(starsFor(par, timeBudget(par, 4))).toBe(3);
  });
  test('a solver at par earns 3 stars on a 2-piece level', () => {
    const par = parFromSolution([{ turns: 0 }, { turns: 0 }]);
    expect(starsFor(par, timeBudget(par, 2))).toBe(3);
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
