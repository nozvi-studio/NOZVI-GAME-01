import { localizationConfig } from './localizationConfig.ts';
import type { SupportedLocale } from './types.ts';
import { getSafeStorage } from '../infrastructure/safeStorage.ts';

export class LocaleSettings {
  private static getStorage(): Storage | null {
    return getSafeStorage();
  }

  public static getSavedLocale(): SupportedLocale | null {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(localizationConfig.storageKey);
      if (!raw) return null;
      if (raw === 'en') {
        this.saveLocale('en-US');
        return 'en-US';
      }
      if ((localizationConfig.supportedLocales as readonly string[]).includes(raw)) {
        return raw as SupportedLocale;
      }
    } catch {
      // storage unavailable
    }
    return null;
  }

  public static saveLocale(locale: SupportedLocale): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(localizationConfig.storageKey, locale);
    } catch {}
  }

  public static clearSavedLocale(): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(localizationConfig.storageKey);
    } catch {}
  }
}
