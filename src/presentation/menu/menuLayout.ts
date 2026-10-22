/**
 * Vertical rhythm of the main menu, in design units (720 wide). The old layout
 * pinned every block to a fraction of the screen height while the blocks kept
 * their size, so short phones squeezed the gaps until the emblem touched the
 * caption. Here the footer, buttons and caption stack upward from the bottom
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
  factTopY: number;
  factHeight: number;
  /** Centre of the caption slot (the card is centred in it whatever its line count). */
  factY: number;
  primaryY: number;
  primaryHeight: number;
  secondaryY: number;
  secondaryHeight: number;
  footerY: number;
};

const PRIMARY_H = 96;
const SECONDARY_H = 77;
const FOOTER_LINE_H = 18;
const FOOTER_FROM_BOTTOM = 40;
const GAP_FOOTER = 36;
const GAP_BUTTONS = 28;
const GAP_FACT = 28;
/** Room for a three-line caption: 3 x 29 + padding. */
const FACT_H = 118;
const LOGO_REFLECTION_BELOW = 130;
const EMBLEM_RING_R = 244;
const EMBLEM_GAP = 24;
const MIN_EMBLEM_SCALE = 0.6;
const LOGO_MIN_Y = 250;
const LOGO_MAX_Y = 330;
const LOGO_BELOW_TOP_CONTROLS = 200;

export function computeMenuLayout(viewHeight: number, safeTop = 0, safeBottom = 0): MenuLayout {
  const footerY = viewHeight - safeBottom - FOOTER_FROM_BOTTOM;
  const secondaryY = footerY - FOOTER_LINE_H / 2 - GAP_FOOTER - SECONDARY_H / 2;
  const primaryY = secondaryY - SECONDARY_H / 2 - GAP_BUTTONS - PRIMARY_H / 2;
  const factTopY = primaryY - PRIMARY_H / 2 - GAP_FACT - FACT_H;

  const logoCenterY = Math.max(Math.min(Math.max(viewHeight * 0.2, LOGO_MIN_Y), LOGO_MAX_Y), safeTop + LOGO_BELOW_TOP_CONTROLS);
  const logoBottomY = logoCenterY + LOGO_REFLECTION_BELOW;

  const roomTop = logoBottomY + EMBLEM_GAP;
  const roomBottom = factTopY - EMBLEM_GAP;
  const room = roomBottom - roomTop;
  const emblemScale = Math.min(1, Math.max(MIN_EMBLEM_SCALE, room / (2 * EMBLEM_RING_R)));
  const emblemRadius = EMBLEM_RING_R * emblemScale;

  return {
    logoCenterY,
    logoBottomY,
    emblemY: (roomTop + roomBottom) / 2,
    emblemScale,
    emblemRadius,
    factTopY,
    factHeight: FACT_H,
    factY: factTopY + FACT_H / 2,
    primaryY,
    primaryHeight: PRIMARY_H,
    secondaryY,
    secondaryHeight: SECONDARY_H,
    footerY,
  };
}
