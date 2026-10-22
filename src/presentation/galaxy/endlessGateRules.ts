/** Level whose completion opens each chapter's Endless gate on the map. */
export const ENDLESS_UNLOCK_LEVEL: Readonly<Record<number, string>> = { 1: '1-10', 2: '2-15' };

/** Chapters that already have an endless pool to play; the gate shows for the rest but cannot start a run. */
const ENDLESS_PLAYABLE_CHAPTERS: readonly number[] = [1];

export type EndlessGateState = {
  unlockLevelId: string;
  /** The unlock level is done (or the harness previews it). */
  reached: boolean;
  /** An endless pool exists for the chapter. */
  playable: boolean;
  /** Tapping the gate starts a run. */
  open: boolean;
};

export function endlessGateState(chapter: number, completed: readonly string[], harness: boolean): EndlessGateState {
  const unlockLevelId = ENDLESS_UNLOCK_LEVEL[chapter] ?? '';
  const reached = harness || completed.includes(unlockLevelId);
  const playable = ENDLESS_PLAYABLE_CHAPTERS.includes(chapter);
  return { unlockLevelId, reached, playable, open: reached && playable };
}

/** Centre of the band's galaxy nearest to `y`: where the gate sits beside the level that opens it. */
export function galaxyCentreNear(art: ReadonlyArray<{ x: number; y: number }> | undefined, y: number): { x: number; y: number } | undefined {
  if (!art || art.length === 0) return undefined;
  const nearest = art.reduce((best, a) => (Math.abs(a.y - y) < Math.abs(best.y - y) ? a : best));
  return { x: nearest.x, y: nearest.y };
}
