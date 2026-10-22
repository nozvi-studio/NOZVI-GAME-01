import { chapterRoman } from '../content/chapters.ts';
import { LocaleResolver } from './LocaleResolver.ts';
import { LocaleSettings } from './LocaleSettings.ts';
import { localizationConfig, LOCALE_REGISTRY } from './localizationConfig.ts';
import type {
  CommonTranslations,
  GameTranslations,
  LocaleMetadata,
  SupportedLocale,
  TranslationBundle,
} from './types.ts';

import enCommon from '../locales/en-US/common.json';
import enGame from '../locales/en-US/game.json';
import viCommon from '../locales/vi/common.json';
import viGame from '../locales/vi/game.json';
import idCommon from '../locales/id/common.json';
import idGame from '../locales/id/game.json';
import ptCommon from '../locales/pt-BR/common.json';
import ptGame from '../locales/pt-BR/game.json';
import jaCommon from '../locales/ja/common.json';
import jaGame from '../locales/ja/game.json';
import esCommon from '../locales/es/common.json';
import esGame from '../locales/es/game.json';
import frCommon from '../locales/fr/common.json';
import frGame from '../locales/fr/game.json';
import deCommon from '../locales/de/common.json';
import deGame from '../locales/de/game.json';
import koCommon from '../locales/ko/common.json';
import koGame from '../locales/ko/game.json';
import zhCommon from '../locales/zh-CN/common.json';
import zhGame from '../locales/zh-CN/game.json';

export class LocalizationManager {
  private static instance: LocalizationManager;

  private currentLocale: SupportedLocale;
  private readonly bundles: Record<SupportedLocale, TranslationBundle>;
  private readonly listeners = new Set<(locale: SupportedLocale) => void>();

  private constructor() {
    this.bundles = {
      'en-US': { common: enCommon as CommonTranslations, game: enGame as unknown as GameTranslations },
      vi: { common: viCommon as CommonTranslations, game: viGame as unknown as GameTranslations },
      id: { common: idCommon as CommonTranslations, game: idGame as unknown as GameTranslations },
      'pt-BR': { common: ptCommon as CommonTranslations, game: ptGame as unknown as GameTranslations },
      ja: { common: jaCommon as CommonTranslations, game: jaGame as unknown as GameTranslations },
      es: { common: esCommon as CommonTranslations, game: esGame as unknown as GameTranslations },
      fr: { common: frCommon as CommonTranslations, game: frGame as unknown as GameTranslations },
      de: { common: deCommon as CommonTranslations, game: deGame as unknown as GameTranslations },
      ko: { common: koCommon as CommonTranslations, game: koGame as unknown as GameTranslations },
      'zh-CN': { common: zhCommon as CommonTranslations, game: zhGame as unknown as GameTranslations },
    };
    this.currentLocale = LocaleResolver.resolve();
  }

  public static getInstance(): LocalizationManager {
    if (!LocalizationManager.instance) {
      LocalizationManager.instance = new LocalizationManager();
    }
    return LocalizationManager.instance;
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public getMetadata(locale: SupportedLocale = this.currentLocale): LocaleMetadata {
    return LOCALE_REGISTRY[locale];
  }

  public setLocale(locale: SupportedLocale | 'en'): void {
    const targetLocale: SupportedLocale = locale === 'en' ? 'en-US' : locale;
    if (!(localizationConfig.supportedLocales as readonly string[]).includes(targetLocale)) return;
    if (this.currentLocale === targetLocale) return;

    this.currentLocale = targetLocale;
    if (localizationConfig.persistSelectedLocale) {
      LocaleSettings.saveLocale(targetLocale);
    }

    this.listeners.forEach((listener) => listener(targetLocale));
  }

  public onLocaleChange(listener: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public t(key: keyof CommonTranslations, params?: Record<string, string | number>): string {
    const dict = this.bundles[this.currentLocale]?.common || this.bundles['en-US'].common;
    let text = dict[key] || this.bundles['en-US'].common[key] || String(key);

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      }
    }
    return text;
  }

  public getLevelTitle(levelId: string, fallbackTitle = ''): string {
    const titles = this.bundles[this.currentLocale]?.game?.levelTitles || this.bundles['en-US'].game.levelTitles;
    return (
      titles[levelId] ||
      (fallbackTitle ? fallbackTitle : this.bundles['en-US'].game.levelTitles[levelId] || levelId)
    );
  }

  public getChapterName(chapter: number, fallbackName?: string): string {
    const chapters = this.bundles[this.currentLocale]?.game?.chapters || this.bundles['en-US'].game.chapters;
    return chapters[String(chapter)] || fallbackName || this.bundles['en-US'].game.chapters[String(chapter)] || `Chapter ${chapter}`;
  }

  public getChapterLabel(chapter: number, fallbackName?: string): string {
    const roman = chapterRoman(chapter);
    const prefix = this.t('chapter_prefix');
    const name = this.getChapterName(chapter, fallbackName);
    return `${prefix} ${roman} · ${name}`;
  }

  public getRandomMenuTagline(forcedIndex?: number): string {
    const list = this.bundles[this.currentLocale]?.game?.taglines || this.bundles['en-US'].game.taglines;
    if (forcedIndex !== undefined && forcedIndex >= 0 && forcedIndex < list.length) {
      return list[forcedIndex];
    }
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  public getVictoryVerse(levelId: string, fallbackVerse = ''): string {
    const verses = this.bundles[this.currentLocale]?.game?.victoryVerses || this.bundles['en-US'].game?.victoryVerses;
    return (
      verses?.[levelId] ||
      (fallbackVerse ? fallbackVerse : this.bundles['en-US'].game?.victoryVerses?.[levelId] || '')
    );
  }

  public getChapterTagline(chapter: number, fallbackTagline?: string): string {
    const taglines = this.bundles[this.currentLocale]?.game?.chapterTaglines || this.bundles['en-US'].game?.chapterTaglines;
    return (
      taglines?.[String(chapter)] ||
      fallbackTagline ||
      this.bundles['en-US'].game?.chapterTaglines?.[String(chapter)] ||
      ''
    );
  }

  public getGalaxyType(chapter: number, fallbackType?: string): string {
    const types = this.bundles[this.currentLocale]?.game?.galaxyTypes || this.bundles['en-US'].game?.galaxyTypes;
    return (
      types?.[String(chapter)] ||
      fallbackType ||
      this.bundles['en-US'].game?.galaxyTypes?.[String(chapter)] ||
      ''
    );
  }

  public getMenuTagline(chapter?: number, fallbackTagline?: string): string {
    if (chapter !== undefined) {
      const chTag = this.getChapterTagline(chapter);
      if (chTag) return chTag;
    }
    return fallbackTagline || this.getRandomMenuTagline();
  }

  public getChapterVerses(chapter: number): readonly string[] | undefined {
    return (
      this.bundles[this.currentLocale]?.game?.chapterVerses?.[String(chapter)] ||
      this.bundles['en-US']?.game?.chapterVerses?.[String(chapter)]
    );
  }
}
