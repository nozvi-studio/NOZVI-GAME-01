import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleSettings } from '../src/localization/LocaleSettings.ts';
import { getEndlessLevelNumber, saveEndlessLevelNumber } from '../src/content/endless/endlessCatalog.ts';

afterEach(() => vi.unstubAllGlobals());

function blockedWindow() {
  return Object.defineProperty({}, 'localStorage', {
    get() { throw new DOMException('Blocked', 'SecurityError'); },
  });
}

describe('safe storage access', () => {
  it('returns null when the window storage getter throws', async () => {
    vi.stubGlobal('window', blockedWindow());
    const { getSafeStorage } = await import('../src/infrastructure/safeStorage.ts');
    expect(getSafeStorage()).toBeNull();
  });

  it('returns available browser storage', async () => {
    const storage = { getItem: () => null, setItem: () => {} };
    vi.stubGlobal('window', { localStorage: storage });
    const { getSafeStorage } = await import('../src/infrastructure/safeStorage.ts');
    expect(getSafeStorage()).toBe(storage);
  });

  it('handles a throwing global getter without a window', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
    const { getSafeStorage } = await import('../src/infrastructure/safeStorage.ts');
    expect(getSafeStorage()).toBeNull();
    expect(getEndlessLevelNumber()).toBe(1);
    expect(() => saveEndlessLevelNumber(1, 2)).not.toThrow();
  });

  it('lets locale settings read, save and clear when the getter throws', () => {
    vi.stubGlobal('window', blockedWindow());
    expect(LocaleSettings.getSavedLocale()).toBeNull();
    expect(() => LocaleSettings.saveLocale('vi')).not.toThrow();
    expect(() => LocaleSettings.clearSavedLocale()).not.toThrow();
  });

  it('shares memory progress between repositories when browser storage is blocked', async () => {
    vi.stubGlobal('window', blockedWindow());
    const { getSafeStorage, memoryStorage } = await import('../src/infrastructure/safeStorage.ts');
    const { createProgressRepository } = await import('../src/infrastructure/progressRepository.ts');
    const first = createProgressRepository(getSafeStorage() ?? memoryStorage, [], 'test');
    first.setMusic(false);
    const next = createProgressRepository(getSafeStorage() ?? memoryStorage, [], 'test');
    expect(next.read().progress.settings.music).toBe(false);
  });
});
