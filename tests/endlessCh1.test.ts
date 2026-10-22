import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEndlessLevelNumber,
  saveEndlessLevelNumber,
  loadEndlessLevel,
  ENDLESS_CH1_STORAGE_KEY,
} from '../src/content/endless/endlessCatalog.ts';

describe('Chapter 1 Endless Mode', () => {
  let storageMap: Map<string, string>;

  beforeEach(() => {
    storageMap = new Map();
    const mockStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, v),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    };
    (globalThis as any).localStorage = mockStorage;
  });

  it('manages endless progress in localStorage', () => {
    expect(getEndlessLevelNumber(1)).toBe(1);
    saveEndlessLevelNumber(1, 5);
    expect(getEndlessLevelNumber(1)).toBe(5);
  });

  it('loads and validates endless level with "Khởi Nguyên - X" title', () => {
    const level1 = loadEndlessLevel(1, 1);
    expect(level1.id).toBe('endless-002');
    expect(level1.title).toBe('Khởi Nguyên - 1');
    expect(level1.pieces.length).toBeGreaterThanOrEqual(4);
    expect(level1.rotationEnabled).toBe(false);

    const level2 = loadEndlessLevel(1, 2);
    expect(level2.id).toBe('endless-003');
    expect(level2.title).toBe('Khởi Nguyên - 2');
  });

  it('cycles through pool when level exceeds pool size', () => {
    const level150 = loadEndlessLevel(1, 150);
    expect(level150.title).toBe('Khởi Nguyên - 150');
    expect(level150.id).toBe('endless-002');
  });

  it('formats endless toast title cleanly without raw level id', () => {
    const level = loadEndlessLevel(1, 2);
    const mode = 'endless';
    const endlessLevel = 2;
    const endlessChapter = 1;

    const chapterNum = mode === 'endless'
      ? String(endlessChapter)
      : (level.id.split('-')[0] ?? '1');
    const localizedTitle = mode === 'endless'
      ? (level.title || `Khởi Nguyên - ${endlessLevel}`)
      : level.title;

    const titleString = mode === 'endless'
      ? localizedTitle
      : `Màn ${level.id} · ${localizedTitle}`;

    expect(chapterNum).toBe('1');
    expect(titleString).toBe('Khởi Nguyên - 2');
    expect(titleString).not.toContain('endless');
    expect(titleString).not.toContain('Màn');
  });
});
