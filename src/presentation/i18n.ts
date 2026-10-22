/**
 * Hệ thống đa ngôn ngữ (i18n) cho Mirror.
 * Backward-compatible facade chuyển tiếp tới LocalizationManager lõi.
 */

import { LocalizationManager } from '../localization/LocalizationManager.ts';
import type { CommonTranslationKey, SupportedLocale } from '../localization/types.ts';
import enCommon from '../locales/en-US/common.json';
import enGame from '../locales/en-US/game.json';
import viCommon from '../locales/vi/common.json';
import viGame from '../locales/vi/game.json';
import { createCosmicFactRepository } from '../infrastructure/cosmicFactRepository.ts';
import type { StoragePort } from '../application/progressPort.ts';

export type Locale = SupportedLocale | 'en';
export type TranslationKey = CommonTranslationKey;

const manager = LocalizationManager.getInstance();

const safeStorage: StoragePort = {
  getItem: (key: string) => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
    } catch {}
    return null;
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
};

const cosmicFactRepo = createCosmicFactRepository(safeStorage);

export const getLocale = (): Locale => manager.getLocale();
export const setLocale = (locale: Locale): void => manager.setLocale(locale);
export const onLocaleChange = (cb: (locale: SupportedLocale) => void): (() => void) => manager.onLocaleChange(cb);
export const t = (key: TranslationKey, params?: Record<string, string | number>): string => manager.t(key, params);
export const getLevelTitle = (id: string, fallback: string): string => manager.getLevelTitle(id, fallback);
export const getChapterName = (chapter: number, fallback?: string): string => manager.getChapterName(chapter, fallback);
export const getChapterLabel = (chapter: number, fallback?: string): string => manager.getChapterLabel(chapter, fallback);
export const getRandomMenuTagline = (forcedIndex?: number): string => manager.getRandomMenuTagline(forcedIndex);
export const getVictoryVerse = (levelId: string, fallbackVerse?: string): string => manager.getVictoryVerse(levelId, fallbackVerse);
export const getChapterTagline = (chapter: number, fallbackTagline?: string): string => manager.getChapterTagline(chapter, fallbackTagline);
export const getGalaxyType = (chapter: number, fallbackType?: string): string => manager.getGalaxyType(chapter, fallbackType);
export const getMenuTagline = (chapter?: number, fallbackTagline?: string): string => manager.getMenuTagline(chapter, fallbackTagline);

export const getChapterVerses = (chapter: number): readonly string[] | undefined =>
  manager.getChapterVerses(chapter);

export const getNextChapterVerse = (chapter: number): string => {
  const pool = manager.getChapterVerses(chapter);
  if (pool && pool.length > 0) {
    const idx = cosmicFactRepo.nextFactIndex(chapter, pool.length);
    return pool[idx] || '';
  }
  return manager.getChapterTagline(chapter);
};

export const peekChapterVerse = (chapter: number): string => {
  const pool = manager.getChapterVerses(chapter);
  if (pool && pool.length > 0) {
    const idx = cosmicFactRepo.peekFactIndex(chapter, pool.length);
    return pool[idx] || '';
  }
  return manager.getChapterTagline(chapter);
};

export const resetCosmicFacts = (): void => {
  cosmicFactRepo.reset();
};

/** Bản dịch tương thích ngược */
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  vi: viCommon,
  en: enCommon,
  'en-US': enCommon,
};

/** Phụ đề thiên văn tương thích ngược */
export const MENU_TAGLINES: Record<string, readonly string[]> = {
  vi: viGame.taglines,
  en: enGame.taglines,
  'en-US': enGame.taglines,
};

/** Tên màn chơi tiếng Anh tương thích ngược */
export const LEVEL_TITLES_EN: Record<string, string> = enGame.levelTitles;

/** Tên các chương theo ngôn ngữ phục vụ tương thích ngược */
export const CHAPTER_NAMES: Record<string, Record<number, string>> = {
  vi: {
    1: 'Khởi Nguyên',
    2: 'Giao Thoa',
    3: 'Luân Chuyển',
    4: 'Hội Tụ',
    5: 'Lăng Kính',
  },
  'en-US': {
    1: 'Genesis',
    2: 'Intersections',
    3: 'Rotations',
    4: 'Convergence',
    5: 'Prism',
  },
  en: {
    1: 'Genesis',
    2: 'Intersections',
    3: 'Rotations',
    4: 'Convergence',
    5: 'Prism',
  },
  id: {
    1: 'Permulaan',
    2: 'Persimpangan',
    3: 'Rotasi',
    4: 'Konvergensi',
    5: 'Prisma',
  },
  'pt-BR': {
    1: 'Gênesis',
    2: 'Interseções',
    3: 'Rotações',
    4: 'Convergência',
    5: 'Prisma',
  },
  ja: {
    1: '始まり',
    2: '交差',
    3: '回転',
    4: '収束',
    5: 'プリズム',
  },
};
