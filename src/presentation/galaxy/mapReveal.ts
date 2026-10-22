import type { Chapter } from '../../domain/model.ts';
import type { CampaignMapLayout } from './constellationLayout.ts';

/**
 * How much of the campaign map the player may scroll to: the chapter they are
 * playing plus a preview of the next one. Everything beyond is sealed behind
 * fog until they finish their current chapter.
 */
export type MapReveal = {
  /** Lowest world-y the camera may reach. */
  limitY: number;
  /** True when fog stops the map at a chapter boundary (always, while anything stays sealed). */
  chapterTail: boolean;
  /** The chapter whose completion lifts the fog (null when nothing remains sealed). */
  sealedUntilChapter: Chapter | null;
};

const OPEN: MapReveal = { limitY: Number.POSITIVE_INFINITY, chapterTail: false, sealedUntilChapter: null };

/**
 * @param frontierId first level the player has not completed; null when the whole campaign is done.
 */
export function computeMapReveal(layout: CampaignMapLayout, frontierId: string | null): MapReveal {
  const open = { ...OPEN, limitY: layout.totalHeight };
  const frontier = frontierId === null ? undefined : layout.nodes.find((node) => node.id === frontierId);
  if (!frontier) return open;

  const preview = layout.chapters.find((band) => band.chapter > frontier.chapter);
  if (!preview || preview.bottom >= layout.totalHeight) return open;
  return { limitY: preview.bottom, chapterTail: true, sealedUntilChapter: frontier.chapter };
}
