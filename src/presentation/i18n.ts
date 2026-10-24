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
import { setFontLocale } from './designTokens.ts';
import { createCosmicFactRepository } from '../infrastructure/cosmicFactRepository.ts';
import type { StoragePort } from '../application/progressPort.ts';

export type Locale = SupportedLocale | 'en';
export type TranslationKey = CommonTranslationKey;

const manager = LocalizationManager.getInstance();

// The CJK font stack follows the active language (Han glyphs differ between ja, ko and zh-CN).
setFontLocale(manager.getLocale());
manager.onLocaleChange(setFontLocale);

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

