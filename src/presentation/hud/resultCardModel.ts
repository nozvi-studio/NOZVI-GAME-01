import type { LevelResult, ResultRecord } from '../../application/progressPort.ts';
import type { Stars } from '../../domain/starRating.ts';

export type ResultCardModel = {
  stars: Stars;
  timeText: string;
  /** null hides the Best pill (first clear, or nothing saved). */
  best: { text: string; highlight: boolean } | null;
};

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function resultCardModel(r: { elapsedMs: number; stars: Stars; record: ResultRecord }): ResultCardModel {
  const { previous, current, improved } = r.record;
  const best =
    previous === null || current.bestMs === null ? null : { text: formatClock(current.bestMs), highlight: improved };
  return { stars: r.stars, timeText: formatClock(r.elapsedMs), best };
}

/** A level that is already won when the scene opens: show what was saved. */
export function restoredCardModel(saved: LevelResult | undefined): ResultCardModel {
  if (!saved) return { stars: 0, timeText: '-:--', best: null };
  return { stars: saved.stars, timeText: saved.bestMs === null ? '-:--' : formatClock(saved.bestMs), best: null };
}
