import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleResolver } from '../src/localization/LocaleResolver.ts';
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

describe('LocaleResolver', () => {
  beforeEach(() => {
    const storage = createMockStorage();
    (globalThis as any).window = { localStorage: storage };
    (globalThis as any).localStorage = storage;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  });

  it('Tier 1: uses saved preference if present', () => {
    LocaleSettings.saveLocale('ja');
    expect(LocaleResolver.resolve()).toBe('ja');
  });

  it('defaults to en-US and ignores the device language', () => {
    vi.stubGlobal('navigator', { languages: ['vi-VN'], language: 'vi-VN' });
    try {
      expect(LocaleResolver.resolve()).toBe('en-US');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('normalizes device tags cleanly', () => {
    expect(LocaleResolver.matchDeviceTag('vi-VN')).toBe('vi');
    expect(LocaleResolver.matchDeviceTag('pt')).toBe('pt-BR');
    expect(LocaleResolver.matchDeviceTag('en-AU')).toBe('en-US');
    expect(LocaleResolver.matchDeviceTag('unknown')).toBeNull();
  });
});
