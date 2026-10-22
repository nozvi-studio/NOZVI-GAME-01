import { describe, expect, test } from 'vitest';
import {
  BUDGET_MAX_MS,
  BUDGET_MIN_MS,
  parFromSolution,
  starsFor,
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
  test('par / 0.15 inside the clamp', () => {
    expect(timeBudget(4000)).toBe(26_667);
  });
  test('clamps to 20 s and 45 s', () => {
    expect(timeBudget(1000)).toBe(BUDGET_MIN_MS);
    expect(timeBudget(9000)).toBe(BUDGET_MAX_MS);
    expect(timeBudget(100_000)).toBe(BUDGET_MAX_MS);
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
