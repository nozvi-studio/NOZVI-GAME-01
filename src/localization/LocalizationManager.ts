import { chapterRoman } from '../content/chapters.ts';
import { interpolate, Localization } from '../engine/core/localization/Localization.ts';
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

  private readonly core: Localization<SupportedLocale, TranslationBundle>;

  private constructor() {
    const bundles: Record<SupportedLocale, TranslationBundle> = {
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
    this.core = new Localization(bundles, localizationConfig.fallbackLocale, LocaleResolver.resolve(), (locale) => {
      if (localizationConfig.persistSelectedLocale) LocaleSettings.saveLocale(locale);
    });
  }

  public static getInstance(): LocalizationManager {
    if (!LocalizationManager.instance) {
      LocalizationManager.instance = new LocalizationManager();
    }
    return LocalizationManager.instance;
  }

  public getLocale(): SupportedLocale {
    return this.core.locale;
  }

  public getMetadata(locale: SupportedLocale = this.core.locale): LocaleMetadata {
    return LOCALE_REGISTRY[locale];
  }

  public setLocale(locale: SupportedLocale | 'en'): void {
    const targetLocale: SupportedLocale = locale === 'en' ? 'en-US' : locale;
    if (!(localizationConfig.supportedLocales as readonly string[]).includes(targetLocale)) return;
    this.core.set(targetLocale);
  }

  public onLocaleChange(listener: (locale: SupportedLocale) => void): () => void {
    return this.core.onChange(listener);
  }

  public t(key: keyof CommonTranslations, params?: Record<string, string | number>): string {
    const dict = this.core.bundle()?.common || this.core.bundle('en-US').common;
    const text = dict[key] || this.core.bundle('en-US').common[key] || String(key);
    return interpolate(text, params);
  }

  public getLevelTitle(levelId: string, fallbackTitle = ''): string {
    const titles = this.core.bundle()?.game?.levelTitles || this.core.bundle('en-US').game.levelTitles;
    return (
      titles[levelId] ||
      (fallbackTitle ? fallbackTitle : this.core.bundle('en-US').game.levelTitles[levelId] || levelId)
    );
  }

  public getChapterName(chapter: number, fallbackName?: string): string {
    const chapters = this.core.bundle()?.game?.chapters || this.core.bundle('en-US').game.chapters;
    return chapters[String(chapter)] || fallbackName || this.core.bundle('en-US').game.chapters[String(chapter)] || `Chapter ${chapter}`;
  }

  public getChapterLabel(chapter: number, fallbackName?: string): string {
    const roman = chapterRoman(chapter);
    const prefix = this.t('chapter_prefix');
    const name = this.getChapterName(chapter, fallbackName);
    return `${prefix} ${roman} · ${name}`;
  }

  public getRandomMenuTagline(forcedIndex?: number): string {
    const list = this.core.bundle()?.game?.taglines || this.core.bundle('en-US').game.taglines;
    if (forcedIndex !== undefined && forcedIndex >= 0 && forcedIndex < list.length) {
      return list[forcedIndex];
    }
    return list[Math.floor(Math.random() * list.length)] || '';
  }

  public getVictoryVerse(levelId: string, fallbackVerse = ''): string {
    const verses = this.core.bundle()?.game?.victoryVerses || this.core.bundle('en-US').game?.victoryVerses;
    return (
      verses?.[levelId] ||
      (fallbackVerse ? fallbackVerse : this.core.bundle('en-US').game?.victoryVerses?.[levelId] || '')
    );
  }

  public getChapterTagline(chapter: number, fallbackTagline?: string): string {
    const taglines = this.core.bundle()?.game?.chapterTaglines || this.core.bundle('en-US').game?.chapterTaglines;
    return (
      taglines?.[String(chapter)] ||
      fallbackTagline ||
      this.core.bundle('en-US').game?.chapterTaglines?.[String(chapter)] ||
      ''
    );
  }

  public getGalaxyType(chapter: number, fallbackType?: string): string {
    const types = this.core.bundle()?.game?.galaxyTypes || this.core.bundle('en-US').game?.galaxyTypes;
    return (
      types?.[String(chapter)] ||
      fallbackType ||
      this.core.bundle('en-US').game?.galaxyTypes?.[String(chapter)] ||
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
      this.core.bundle()?.game?.chapterVerses?.[String(chapter)] ||
      this.core.bundle('en-US')?.game?.chapterVerses?.[String(chapter)]
    );
  }
}
