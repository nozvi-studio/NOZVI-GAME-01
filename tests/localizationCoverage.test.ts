import { describe, expect, it } from 'vitest';
import { localizationConfig } from '../src/localization/localizationConfig.ts';
import type { GameTranslations } from '../src/localization/types.ts';
import enCommon from '../src/locales/en-US/common.json';
import enGame from '../src/locales/en-US/game.json';
import viCommon from '../src/locales/vi/common.json';
import viGame from '../src/locales/vi/game.json';
import idCommon from '../src/locales/id/common.json';
import idGame from '../src/locales/id/game.json';
import ptCommon from '../src/locales/pt-BR/common.json';
import ptGame from '../src/locales/pt-BR/game.json';
import jaCommon from '../src/locales/ja/common.json';
import jaGame from '../src/locales/ja/game.json';

const BUNDLES = {
  'en-US': { common: enCommon, game: enGame },
  vi: { common: viCommon, game: viGame },
  id: { common: idCommon, game: idGame },
  'pt-BR': { common: ptCommon, game: ptGame },
  ja: { common: jaCommon, game: jaGame },
};

// Màn có tiêu đề và lời chiến thắng riêng theo mã. Các màn mới (1-7…1-10, 2-14…2-28) dùng
// kho chapterVerses của chương nên không cần mục riêng ở đây.
const LOCALIZED_LEVEL_IDS = [
  ...Array.from({ length: 6 }, (_, i) => `1-${i + 1}`),
  ...Array.from({ length: 13 }, (_, i) => `2-${i + 1}`),
];

describe('Localization Coverage & Symmetry', () => {
  const commonKeys = Object.keys(enCommon);

  it('all locales have exactly identical common.json keys', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const keys = Object.keys(BUNDLES[locale].common);
      expect(keys.sort()).toEqual(commonKeys.sort());
      for (const k of commonKeys) {
        const val = (BUNDLES[locale].common as Record<string, string>)[k];
        expect(typeof val).toBe('string');
        expect(val.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('all locales provide chapters 1-5 in game.json', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const ch = BUNDLES[locale].game.chapters as Record<string, string>;
      expect(ch['1']).toBeTruthy();
      expect(ch['2']).toBeTruthy();
      expect(ch['3']).toBeTruthy();
      expect(ch['4']).toBeTruthy();
      expect(ch['5']).toBeTruthy();
    }
  });

  it('all locales provide campaign level titles for the localized ids', () => {
    const levelIds = LOCALIZED_LEVEL_IDS;
    for (const locale of localizationConfig.supportedLocales) {
      const titles = BUNDLES[locale].game.levelTitles as Record<string, string>;
      for (const id of levelIds) {
        expect(titles[id], `missing title for ${id} in ${locale}`).toBeTruthy();
      }
    }
  });

  it('all locales provide exactly 20 astronomical taglines', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const taglines = BUNDLES[locale].game.taglines;
      expect(taglines.length).toBe(20);
      for (const line of taglines) {
        expect(typeof line).toBe('string');
        expect(line.length).toBeGreaterThan(5);
      }
    }
  });

  it('all locales provide campaign victory verses for the localized ids', () => {
    const levelIds = LOCALIZED_LEVEL_IDS;
    for (const locale of localizationConfig.supportedLocales) {
      const verses = BUNDLES[locale].game.victoryVerses as Record<string, string>;
      expect(verses, `missing victoryVerses dictionary in ${locale}`).toBeDefined();
      for (const id of levelIds) {
        expect(verses[id], `missing victory verse for ${id} in ${locale}`).toBeTruthy();
        expect(verses[id].trim().length).toBeGreaterThan(5);
      }
    }
  });

  it('all locales provide victory_eyebrow and level_badge_label in common.json', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const common = BUNDLES[locale].common as Record<string, string>;
      expect(common.victory_eyebrow, `missing victory_eyebrow in ${locale}`).toBeTruthy();
      expect(common.level_badge_label, `missing level_badge_label in ${locale}`).toBeTruthy();
      expect(common.level_badge_label).toContain('{id}');
    }
  });

  it('victory facts respect per-locale line length budget (<=115 Latin, <=70 Japanese)', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const verses = Object.values(BUNDLES[locale].game.victoryVerses as Record<string, string>);
      expect(new Set(verses).size, `duplicate victory fact in ${locale}`).toBe(verses.length);
      const maxBudget = locale === 'ja' ? 70 : 115;
      for (const text of verses) {
        expect(text.length, `${locale}: "${text}" exceeds budget ${maxBudget}`).toBeLessThanOrEqual(maxBudget);
      }
    }
  });

  it('all locales provide chapter taglines and galaxy types for chapters 1-5', () => {
    for (const locale of localizationConfig.supportedLocales) {
      const taglines = BUNDLES[locale].game.chapterTaglines as Record<string, string>;
      const types = BUNDLES[locale].game.galaxyTypes as Record<string, string>;
      expect(taglines, `missing chapterTaglines dictionary in ${locale}`).toBeDefined();
      expect(types, `missing galaxyTypes dictionary in ${locale}`).toBeDefined();
      for (let ch = 1; ch <= 5; ch++) {
        expect(taglines[String(ch)], `missing chapterTagline for ${ch} in ${locale}`).toBeTruthy();
        expect(types[String(ch)], `missing galaxyType for ${ch} in ${locale}`).toBeTruthy();
      }
    }
  });

  it('all locales provide exactly 15 chapterVerses per chapter (1, 2, 3) within character budgets and no internal duplicates', () => {
    const chapters = ['1', '2', '3'];
    for (const locale of localizationConfig.supportedLocales) {
      const game = BUNDLES[locale].game as GameTranslations;
      expect(game.chapterVerses, `Missing chapterVerses in ${locale}`).toBeDefined();
      for (const ch of chapters) {
        const list = game.chapterVerses?.[ch];
        expect(Array.isArray(list), `chapterVerses[${ch}] should be an array in ${locale}`).toBe(true);
        expect(list?.length, `chapterVerses[${ch}] in ${locale} must have exactly 15 items`).toBe(15);
        expect(new Set(list).size, `chapterVerses[${ch}] in ${locale} contains duplicate facts`).toBe(15);
        list?.forEach((verse, idx) => {
          const maxBudget = locale === 'ja' ? 70 : 115;
          expect(
            verse.length,
            `chapterVerses[${ch}][${idx}] in ${locale} exceeded budget ${maxBudget} (${verse.length} chars): "${verse}"`
          ).toBeLessThanOrEqual(maxBudget);
        });
      }
    }
  });
});
