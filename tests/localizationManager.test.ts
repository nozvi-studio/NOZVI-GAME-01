import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalizationManager } from '../src/localization/LocalizationManager.ts';
import { LocaleSettings } from '../src/localization/LocaleSettings.ts';

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

describe('LocalizationManager', () => {
  beforeEach(() => {
    const storage = createMockStorage();
    (globalThis as any).window = { localStorage: storage };
    (globalThis as any).localStorage = storage;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('translates common keys with param interpolation', () => {
    const mgr = LocalizationManager.getInstance();
    mgr.setLocale('en-US');
    expect(mgr.t('btn_start')).toBe('Start');
    expect(mgr.t('match_count', { matched: 3, total: 5 })).toBe('3/5 pieces matched');
  });

  it('changes locale and notifies subscribers', () => {
    const mgr = LocalizationManager.getInstance();
    mgr.setLocale('en-US');
    let notified: string | null = null;
    const unsub = mgr.onLocaleChange((loc) => {
      notified = loc;
    });

    mgr.setLocale('ja');
    expect(mgr.getLocale()).toBe('ja');
    expect(notified).toBe('ja');
    expect(mgr.t('btn_start')).toBe('スタート');
    expect(LocaleSettings.getSavedLocale()).toBe('ja');

    unsub();
    mgr.setLocale('vi');
    expect(notified).toBe('ja'); // callback unsubscribed
  });

  it('resolves localized level titles and chapter names', () => {
    const mgr = LocalizationManager.getInstance();
    mgr.setLocale('pt-BR');
    expect(mgr.getChapterName(1)).toBe('Gênesis');
    expect(mgr.getLevelTitle('1-1')).toBe('Estrelas Gêmeas');
    expect(mgr.getChapterLabel(2)).toBe('Capítulo II · Interseções');
  });

  it('resolves localized victory verses, chapter taglines, and galaxy types', () => {
    const mgr = LocalizationManager.getInstance();
    mgr.setLocale('ja');
    expect(mgr.getVictoryVerse('1-1')).toBe('矮小銀河は、宇宙で最もありふれたタイプの銀河です。');
    expect(mgr.getChapterTagline(1)).toBe('大マゼラン雲は天の川銀河を周回する矮小銀河です');
    expect(mgr.getGalaxyType(1)).toBe('矮小銀河');
    expect(mgr.getMenuTagline(1)).toBe('大マゼラン雲は天の川銀河を周回する矮小銀河です');

    mgr.setLocale('en-US');
    expect(mgr.getVictoryVerse('1-1')).toBe('Dwarf galaxies are the most common kind of galaxy in the universe.');
    expect(mgr.getChapterTagline(2)).toBe('Our Milky Way is a barred spiral galaxy');
    expect(mgr.getGalaxyType(2)).toBe('Spiral galaxy');

    // fallback when key missing
    expect(mgr.getVictoryVerse('custom-99', 'Fallback verse')).toBe('Fallback verse');
    expect(mgr.getChapterTagline(99, 'Fallback tag')).toBe('Fallback tag');
    expect(mgr.getGalaxyType(99, 'Fallback type')).toBe('Fallback type');
  });
});

describe('LocalizationManager.getChapterVerses & i18n facade', () => {
  it('returns chapterVerses array for chapters 1-3', () => {
    const lm = LocalizationManager.getInstance();
    const ch1 = lm.getChapterVerses(1);
    expect(ch1).toBeDefined();
    expect(ch1?.length).toBe(15);
  });

  it('returns undefined for chapter with no pool', () => {
    const lm = LocalizationManager.getInstance();
    expect(lm.getChapterVerses(99)).toBeUndefined();
  });

  it('draws facts from chapter 1 pool via getNextChapterVerse', async () => {
    const { getNextChapterVerse, getChapterVerses } = await import('../src/presentation/i18n.ts');
    const fact = getNextChapterVerse(1);
    expect(typeof fact).toBe('string');
    expect(fact.length).toBeGreaterThan(0);
    const pool = getChapterVerses(1) ?? [];
    expect(pool.includes(fact)).toBe(true);
  });

  it('peekChapterVerse returns same fact without consuming', async () => {
    const { peekChapterVerse } = await import('../src/presentation/i18n.ts');
    const peek1 = peekChapterVerse(1);
    const peek2 = peekChapterVerse(1);
    expect(peek1).toBe(peek2);
  });

  it('getRandomMenuTagline returns a non-empty string and supports forcedIndex', async () => {
    const { getRandomMenuTagline } = await import('../src/presentation/i18n.ts');
    const lm = LocalizationManager.getInstance();
    lm.setLocale('vi');
    const tag = getRandomMenuTagline();
    expect(typeof tag).toBe('string');
    expect(tag.length).toBeGreaterThan(0);

    const forced0 = getRandomMenuTagline(0);
    expect(forced0).toContain('Thiên hà lùn');

    const forced1 = getRandomMenuTagline(1);
    expect(forced1).toContain('Đám Mây Magellan');
  });
});
