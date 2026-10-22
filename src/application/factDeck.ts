export type FactDeck = { next(): string };

/**
 * An in-memory shuffled deck: every fact once per cycle, and the first fact of a new cycle
 * is never the last one shown. Not persisted, so it never touches the win-card shuffle bag.
 */
export function createFactDeck(pool: readonly string[], rng: () => number = Math.random): FactDeck {
  if (pool.length === 0) throw new Error('createFactDeck: empty pool');
  let order: number[] = [];
  let cursor = 0;
  let last = -1;

  const reshuffle = (): void => {
    order = pool.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
    cursor = 0;
  };
  reshuffle();

  return {
    next() {
      if (cursor >= order.length) reshuffle();
      const index = order[cursor];
      cursor += 1;
      last = index;
      return pool[index];
    },
  };
}

/** Facts for chapters 1..maxChapter (the player's furthest chapter), so locked galaxies are not spoiled. */
export function buildFactPool(
  maxChapter: number,
  versesOf: (chapter: number) => readonly string[] | undefined,
  taglineOf: (chapter: number) => string
): string[] {
  const pool: string[] = [];
  for (let chapter = 1; chapter <= Math.max(1, maxChapter); chapter += 1) {
    const verses = versesOf(chapter);
    if (verses && verses.length > 0) pool.push(...verses);
    else pool.push(taglineOf(chapter));
  }
  return pool.filter((fact) => fact.trim().length > 0);
}
