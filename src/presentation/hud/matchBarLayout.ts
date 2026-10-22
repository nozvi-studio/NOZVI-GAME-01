export type MatchBarLayout = {
  centerX: number;
  width: number;
  iconSize: number;
  iconGap: number;
  /** Icon centers and text origin are local to the bar's center. */
  iconCenters: number[];
  textX: number;
  textScale: number;
};

/** Fit the counter between the action clearances; discard jewels before shrinking text. */
export function computeMatchBarLayout(
  total: number,
  textWidth: number,
  left: number,
  right: number
): MatchBarLayout {
  const padding = 24;
  const available = right - left;
  const iconBudget = available - padding * 2 - textWidth;
  const showIcons = total > 0 && total * (9 * 2 + 6) <= iconBudget;
  const compact = showIcons ? Math.min(1, (iconBudget / total - 24) / 14) : 0;
  const iconSize = 9 + 5 * compact;
  const iconGap = 6 + 4 * compact;
  const iconsWidth = showIcons ? total * (iconSize * 2 + iconGap) : 0;
  const textScale = textWidth > 0 ? Math.min(1, (available - padding * 2) / textWidth) : 1;
  const width = Math.min(available, iconsWidth + textWidth * textScale + padding * 2);
  return {
    centerX: (left + right) / 2,
    width,
    iconSize,
    iconGap,
    iconCenters: showIcons
      ? Array.from({ length: total }, (_, i) => -width / 2 + padding + iconSize + i * (iconSize * 2 + iconGap))
      : [],
    textX: -width / 2 + padding + iconsWidth,
    textScale,
  };
}
