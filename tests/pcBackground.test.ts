import { describe, expect, it } from 'vitest';
import { chapterOfLevelId, pcBackgroundUrl } from '../src/presentation/sky/pcBackground.ts';

describe('pcBackground', () => {
  it('maps chapters 1-5 to their painted file', () => {
    for (const chapter of [1, 2, 3, 4, 5]) {
      expect(pcBackgroundUrl(chapter)).toBe(`/assets/backgrounds/mirror-bg-pc-chuong-${chapter}.webp`);
    }
  });

  it('honours a relative base', () => {
    expect(pcBackgroundUrl(2, './')).toBe('./assets/backgrounds/mirror-bg-pc-chuong-2.webp');
  });

  it('has no file for chapters outside 1-5', () => {
    expect(pcBackgroundUrl(0)).toBeNull();
    expect(pcBackgroundUrl(6)).toBeNull();
  });

  it('reads the chapter from a level id', () => {
    expect(chapterOfLevelId('3-7')).toBe(3);
    expect(chapterOfLevelId('nonsense')).toBeNull();
  });
});
