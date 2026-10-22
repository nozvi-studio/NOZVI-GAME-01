import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterAllowsRotation, chapterForbidsOverlap } from '../src/content/chapters.ts';

describe('chapter rule helpers', () => {
  it('only chapter 3 allows rotation, like the validator', () => {
    expect(CHAPTERS.filter((c) => chapterAllowsRotation(c.chapter)).map((c) => c.chapter)).toEqual([3]);
  });

  it('unknown chapters do not allow rotation', () => {
    expect(chapterAllowsRotation(9)).toBe(false);
  });

  it('chapters 1 and 3 forbid overlap', () => {
    expect(CHAPTERS.filter((c) => chapterForbidsOverlap(c.chapter)).map((c) => c.chapter)).toEqual([1, 3]);
  });
});
