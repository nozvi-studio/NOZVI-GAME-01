import { describe, expect, it } from 'vitest';
import { buildFactPool, createFactDeck } from '../src/application/factDeck.ts';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

describe('createFactDeck', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];

  it('rejects an empty pool', () => {
    expect(() => createFactDeck([])).toThrow('empty pool');
  });

  it('shows every fact once per cycle', () => {
    const deck = createFactDeck(pool, seeded(1));
    const cycle = Array.from({ length: pool.length }, () => deck.next());
    expect([...cycle].sort()).toEqual([...pool].sort());
  });

  it('never repeats a fact twice in a row, including across the reshuffle', () => {
    const deck = createFactDeck(pool, seeded(7));
    let previous = deck.next();
    for (let i = 0; i < 200; i += 1) {
      const next = deck.next();
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('returns the only fact of a pool of one, repeatedly', () => {
    const deck = createFactDeck(['only']);
    expect(deck.next()).toBe('only');
    expect(deck.next()).toBe('only');
  });
});

describe('buildFactPool', () => {
  const verses: Record<number, string[] | undefined> = { 1: ['v1a', 'v1b'], 2: ['v2a'], 3: undefined };
  const versesOf = (c: number) => verses[c];
  const taglineOf = (c: number) => `tag${c}`;

  it('collects verses of chapters 1..maxChapter', () => {
    expect(buildFactPool(2, versesOf, taglineOf)).toEqual(['v1a', 'v1b', 'v2a']);
  });

  it('falls back to the tagline for a chapter without a pool', () => {
    expect(buildFactPool(3, versesOf, taglineOf)).toEqual(['v1a', 'v1b', 'v2a', 'tag3']);
  });

  it('always reads at least chapter 1 and drops blank entries', () => {
    expect(buildFactPool(0, versesOf, taglineOf)).toEqual(['v1a', 'v1b']);
    expect(buildFactPool(1, () => ['  ', 'ok'], taglineOf)).toEqual(['ok']);
  });
});
