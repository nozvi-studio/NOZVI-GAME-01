import { localizationConfig } from './localizationConfig.ts';
import { LocaleSettings } from './LocaleSettings.ts';
import type { SupportedLocale } from './types.ts';

export class LocaleResolver {
  /** Saved choice, else the default (English). The device language is deliberately ignored. */
  public static resolve(): SupportedLocale {
    return LocaleSettings.getSavedLocale() ?? localizationConfig.defaultLocale;
  }

  public static matchDeviceTag(tag: string): SupportedLocale | null {
    if (!tag) return null;
    const lower = tag.toLowerCase().trim();

    if (lower === 'en-us' || lower === 'en') return 'en-US';
    if (lower === 'vi' || lower.startsWith('vi-')) return 'vi';
    if (lower === 'id' || lower.startsWith('id-')) return 'id';
    if (lower === 'pt-br' || lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
    if (lower === 'ja' || lower.startsWith('ja-')) return 'ja';
    if (lower === 'es' || lower.startsWith('es-')) return 'es';
    if (lower === 'fr' || lower.startsWith('fr-')) return 'fr';
    if (lower === 'de' || lower.startsWith('de-')) return 'de';
    if (lower === 'ko' || lower.startsWith('ko-')) return 'ko';
    if (lower === 'zh-cn' || lower === 'zh' || lower.startsWith('zh-hans') || lower === 'zh-sg') return 'zh-CN';

    if (lower.startsWith('en-')) return 'en-US';

    return null;
  }
}
