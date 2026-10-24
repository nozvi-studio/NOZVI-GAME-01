/**
 * Vertical rhythm of the main menu, in design units (720 wide). The old layout
 * pinned every block to a fraction of the screen height while the blocks kept
 * their size, so short phones squeezed the gaps until the emblem touched the
 * caption. Here the ad slot and buttons stack upward from the bottom
 * with fixed gaps, the logo hangs from the top, and the emblem takes whatever
 * room is left, shrinking (never below `MIN_EMBLEM_SCALE`) only when it must.
 */
export type MenuLayout = {
  logoCenterY: number;
  /** Lowest point of the logo including its mirror reflection. */
  logoBottomY: number;
  emblemY: number;
  /** Multiplier on the hero's base scale, 1 on tall screens. */
  emblemScale: number;
  /** Outer radius of the emblem's dotted ring at `emblemScale`. */
  emblemRadius: number;
  primaryY: number;
  primaryHeight: number;
  secondaryY: number;
  secondaryHeight: number;
  /**
   * Strip reserved at the very bottom for a small banner ad (nothing is drawn in it yet). Centre and height
   * in design units; it sits above the bottom safe inset and below the buttons.
   */
  adSlotY: number;
  adSlotHeight: number;
};

const PRIMARY_H = 96;
const SECONDARY_H = 77;
const GAP_BUTTONS = 28;
/** A 320x50 dp banner is about 100 design units tall on a 360 dp phone; the rest is breathing room. */
export const AD_SLOT_H = 120;
/** Clear space between the lowest button and the ad, so a tap on the button never lands on the banner. */
const GAP_AD = 40;
const LOGO_REFLECTION_BELOW = 130;
const EMBLEM_RING_R = 244;
const EMBLEM_GAP = 24;
const MIN_EMBLEM_SCALE = 0.6;
const LOGO_MIN_Y = 250;
const LOGO_MAX_Y = 330;
const LOGO_BELOW_TOP_CONTROLS = 200;

export function computeMenuLayout(viewHeight: number, safeTop = 0, safeBottom = 0): MenuLayout {
  const adSlotBottom = viewHeight - safeBottom;
  const adSlotY = adSlotBottom - AD_SLOT_H / 2;
  const secondaryY = adSlotBottom - AD_SLOT_H - GAP_AD - SECONDARY_H / 2;
  const primaryY = secondaryY - SECONDARY_H / 2 - GAP_BUTTONS - PRIMARY_H / 2;

  const logoCenterY = Math.max(Math.min(Math.max(viewHeight * 0.2, LOGO_MIN_Y), LOGO_MAX_Y), safeTop + LOGO_BELOW_TOP_CONTROLS);
  const logoBottomY = logoCenterY + LOGO_REFLECTION_BELOW;

  const roomTop = logoBottomY + EMBLEM_GAP;
  const roomBottom = primaryY - PRIMARY_H / 2 - EMBLEM_GAP;
  const room = roomBottom - roomTop;
  const emblemScale = Math.min(1, Math.max(MIN_EMBLEM_SCALE, room / (2 * EMBLEM_RING_R)));
  const emblemRadius = EMBLEM_RING_R * emblemScale;

  return {
    logoCenterY,
    logoBottomY,
    emblemY: (roomTop + roomBottom) / 2,
    emblemScale,
    emblemRadius,
    primaryY,
    primaryHeight: PRIMARY_H,
    secondaryY,
    secondaryHeight: SECONDARY_H,
    adSlotY,
    adSlotHeight: AD_SLOT_H,
  };
}
