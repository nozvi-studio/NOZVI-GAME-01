export type Stars = 0 | 1 | 2 | 3;

/** Starting values; tune after playtests (spec: time stars, "Par from the level document"). */
export const PAR_COEFFICIENTS = { baseMs: 4000, perPieceMs: 2500, perTurnMs: 1200 } as const;

/** A star is lost once this percent of the budget has passed; first entry is the 3-star window. */
export const STAR_PERCENTS = [15, 45, 75] as const;

/**
 * 3 stars are awarded up to par x this ratio (par = expert time). Single knob to tune after playtests;
 * the 2- and 1-star windows follow from `STAR_PERCENTS`.
 */
export const THREE_STAR_PAR_RATIO = 1.25;

/** Expert time for a level, from the placements of its first sample solution. */
export function parFromSolution(steps: ReadonlyArray<{ turns: number }>): number {
  const turns = steps.reduce((sum, step) => sum + step.turns, 0);
  return (
    PAR_COEFFICIENTS.baseMs + PAR_COEFFICIENTS.perPieceMs * steps.length + PAR_COEFFICIENTS.perTurnMs * turns
  );
}

/**
 * The 3-star window is `STAR_PERCENTS[0]` % of the budget and must equal par x `THREE_STAR_PAR_RATIO`.
 * No clamp: a fixed ceiling made every level with 2+ pieces share one window shorter than its own par.
 */
export function timeBudget(parMs: number): number {
  return Math.round((parMs * THREE_STAR_PAR_RATIO * 100) / STAR_PERCENTS[0]);
}

/** Integer comparison (no float thresholds) so exact boundaries are stable. */
export function starsFor(elapsedMs: number, budgetMs: number): Stars {
  const scaled = elapsedMs * 100;
  if (scaled < STAR_PERCENTS[0] * budgetMs) return 3;
  if (scaled < STAR_PERCENTS[1] * budgetMs) return 2;
  if (scaled < STAR_PERCENTS[2] * budgetMs) return 1;
  return 0;
}
