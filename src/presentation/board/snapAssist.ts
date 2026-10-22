/** Which drag cues a level shows. They teach the first levels and then step aside. */
export type SnapAssist = Readonly<{
  /** The target silhouette brightens when a piece reaches a matching anchor. */
  targetGlow: boolean;
  /** The "drop to match" label follows the piece near an anchor. */
  dropLabel: boolean;
  /** The ripple ring around the anchor the piece is about to snap to. */
  ring: boolean;
}>;

export const ALL_ASSIST: SnapAssist = { targetGlow: true, dropLabel: true, ring: true };
export const NO_ASSIST: SnapAssist = { targetGlow: false, dropLabel: false, ring: false };

/** Chapter 1 levels that keep the glow and label, and the ones that keep the ring. */
const GLOW_AND_LABEL_LEVELS = 2;
const RING_LEVELS = 3;

/** Cues for a campaign level id such as `1-2`; everything else (later chapters, endless, unknown ids) gets none. */
export function snapAssistFor(levelId: string, mode: string): SnapAssist {
  if (mode === 'endless') return NO_ASSIST;
  const match = /^1-(\d+)$/.exec(levelId);
  if (!match) return NO_ASSIST;
  const n = Number(match[1]);
  return { targetGlow: n <= GLOW_AND_LABEL_LEVELS, dropLabel: n <= GLOW_AND_LABEL_LEVELS, ring: n <= RING_LEVELS };
}
