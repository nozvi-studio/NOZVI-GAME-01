export type Stars = 0 | 1 | 2 | 3;

/** Starting values; tune after playtests (spec: time stars, "Par from the level document"). */
export const PAR_COEFFICIENTS = { baseMs: 4000, perPieceMs: 2500, perTurnMs: 1200 } as const;

/** A star is lost once this percent of the budget has passed; first entry is the 3-star window. */
export const STAR_PERCENTS = [15, 45, 75] as const;

export const BUDGET_MIN_MS = 20_000;
export const BUDGET_MAX_MS = 45_000;

/** Expert time for a level, from the placements of its first sample solution. */
export function parFromSolution(steps: ReadonlyArray<{ turns: number }>): number {
  const turns = steps.reduce((sum, step) => sum + step.turns, 0);
  return (
    PAR_COEFFICIENTS.baseMs + PAR_COEFFICIENTS.perPieceMs * steps.length + PAR_COEFFICIENTS.perTurnMs * turns
  );
}

/** The 3-star window is `STAR_PERCENTS[0]` % of the budget, so the budget is par divided by it. */
export function timeBudget(parMs: number): number {
  const raw = Math.round((parMs * 100) / STAR_PERCENTS[0]);
  return Math.min(BUDGET_MAX_MS, Math.max(BUDGET_MIN_MS, raw));
}

/** Integer comparison (no float thresholds) so exact boundaries are stable. */
export function starsFor(elapsedMs: number, budgetMs: number): Stars {
  const scaled = elapsedMs * 100;
  if (scaled < STAR_PERCENTS[0] * budgetMs) return 3;
  if (scaled < STAR_PERCENTS[1] * budgetMs) return 2;
  if (scaled < STAR_PERCENTS[2] * budgetMs) return 1;
  return 0;
}
