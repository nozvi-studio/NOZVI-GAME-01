/** Chapter pill on the level-select map (see LevelSelectScene chapter banner). */
const PILL_HALF_W = 165;
const PILL_HALF_H = 36;
const CLEARANCE = 8;

export type PlayBubbleBox = { halfW: number; top: number; bottom: number };

/**
 * The "Play" bubble sits above the current node unless that would cover a chapter pill;
 * then it flips below the node's id. `bubble` is relative to the node centre.
 */
export function playBubbleBelow(nodeX: number, nodeY: number, bubble: PlayBubbleBox, bannerYs: readonly number[]): boolean {
  return bannerYs.some((bannerY) =>
    Math.abs(nodeX - 360) < PILL_HALF_W + bubble.halfW &&
    nodeY + bubble.top < bannerY + PILL_HALF_H + CLEARANCE &&
    nodeY + bubble.bottom > bannerY - PILL_HALF_H - CLEARANCE
  );
}
