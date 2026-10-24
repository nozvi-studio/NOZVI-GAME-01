/**
 * Touch area of the target badge, kept free of Phaser so it can be tested.
 *
 * A Phaser Container measures its hit area from the top-left of its size box, not from its centre, so a
 * circle at (0, 0) lands 96 px up and to the left of the badge. The circle has to sit in the middle of the box.
 */
export const TARGET_BADGE_HIT_SIZE = 192;

export function targetBadgeHitCircle(): { x: number; y: number; radius: number } {
  const radius = TARGET_BADGE_HIT_SIZE / 2;
  return { x: radius, y: radius, radius };
}
