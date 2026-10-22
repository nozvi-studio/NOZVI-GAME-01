/**
 * Star display on the level-select map, from the "Chọn màn · số sao mỗi màn" mockup
 * (docs/figma-html/Chọn màn · số sao mỗi màn-html). Phaser-free so it can be tested.
 */
export const STARS_PER_LEVEL = 3;

export type StarTotal = { earned: number; max: number };

/** Best stars earned over three per level; a level without a stored result counts as zero. */
export function starTotals(
  manifest: ReadonlyArray<{ id: string; chapter: number }>,
  levels: Readonly<Record<string, { stars: number }>>,
  chapter?: number
): StarTotal {
  const entries = chapter === undefined ? manifest : manifest.filter((entry) => entry.chapter === chapter);
  const earned = entries.reduce((sum, entry) => sum + (levels[entry.id]?.stars ?? 0), 0);
  return { earned, max: entries.length * STARS_PER_LEVEL };
}

export function formatStarTotal(total: StarTotal): string {
  return `${total.earned}/${total.max}`;
}

export type NodeStar = { lit: boolean; dx: number; dy: number; outer: number };

// Same as NODE_SCALE / NODE_LABEL_Y in galaxyNode.ts, which imports Phaser and cannot load in tests.
const K = 1.5;
const NODE_LABEL_Y = 42 * K;
// Mockup: side stars 21 px boxes (outer radius 8.5), middle 25 px (10.5) raised 3 px, 1 px gaps.
// The row's centre sits about 19.5 mockup px below the id caption's centre.
const SIDE = { outer: 8.5 * K, dx: 24 * K, dy: NODE_LABEL_Y + 20.7 * K };
const MIDDLE = { outer: 10.5 * K, dx: 0, dy: NODE_LABEL_Y + 19.5 * K };

/** Three stars under a completed node, left to right, lit up to `stars`. */
export function nodeStarRow(stars: number): NodeStar[] {
  return [
    { lit: stars >= 1, dx: -SIDE.dx, dy: SIDE.dy, outer: SIDE.outer },
    { lit: stars >= 2, dx: MIDDLE.dx, dy: MIDDLE.dy, outer: MIDDLE.outer },
    { lit: stars >= 3, dx: SIDE.dx, dy: SIDE.dy, outer: SIDE.outer },
  ];
}
