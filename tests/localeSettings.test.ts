import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocaleSettings } from '../src/localization/LocaleSettings.ts';
import { localizationConfig } from '../src/localization/localizationConfig.ts';

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

describe('LocaleSettings', () => {
  beforeEach(() => {
    const storage = createMockStorage();
    (globalThis as any).window = { localStorage: storage };
    (globalThis as any).localStorage = storage;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('returns null when no locale is saved', () => {
    expect(LocaleSettings.getSavedLocale()).toBeNull();
  });

  it('saves and retrieves supported locales', () => {
    LocaleSettings.saveLocale('pt-BR');
    expect(LocaleSettings.getSavedLocale()).toBe('pt-BR');
  });

  it('migrates legacy en to en-US', () => {
    localStorage.setItem(localizationConfig.storageKey, 'en');
    expect(LocaleSettings.getSavedLocale()).toBe('en-US');
    expect(localStorage.getItem(localizationConfig.storageKey)).toBe('en-US');
  });

  it('ignores unsupported locale values in storage', () => {
    localStorage.setItem(localizationConfig.storageKey, 'invalid-lang');
    expect(LocaleSettings.getSavedLocale()).toBeNull();
  });

  it('returns null safely when window/localStorage is missing', () => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    expect(LocaleSettings.getSavedLocale()).toBeNull();
  });
});
