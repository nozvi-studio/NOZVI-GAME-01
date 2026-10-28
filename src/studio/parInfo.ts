import { STAR_PERCENTS, timeBudget } from '../domain/starRating.ts';

export type ParInfo = {
  parMs: number;
  budgetMs: number;
  /** Elapsed time under which 3, 2 and 1 stars are awarded (see `starsFor`). */
  starWindowsMs: readonly [number, number, number];
};

export function parInfo(parMs: number, pieceCount: number): ParInfo {
  const budgetMs = timeBudget(parMs, pieceCount);
  const window = (percent: number) => (budgetMs * percent) / 100;
  return {
    parMs,
    budgetMs,
    starWindowsMs: [window(STAR_PERCENTS[0]), window(STAR_PERCENTS[1]), window(STAR_PERCENTS[2])],
  };
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
