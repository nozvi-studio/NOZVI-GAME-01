import type { LocaleMetadata, SupportedLocale } from './types.ts';

export const localizationConfig = {
  defaultLocale: 'en-US' as const,
  supportedLocales: ['en-US', 'vi', 'id', 'pt-BR', 'ja'] as const,
  allowManualLanguageSelection: true,
  persistSelectedLocale: true,
  fallbackLocale: 'en-US' as const,
  storageKey: 'nozvi.locale',
};

export const LOCALE_REGISTRY: Readonly<Record<SupportedLocale, LocaleMetadata>> = {
  vi: { code: 'vi', shortLabel: 'VI', nativeName: 'Tiếng Việt', flagEmoji: '🇻🇳' },
  'en-US': { code: 'en-US', shortLabel: 'EN', nativeName: 'English', flagEmoji: '🇺🇸' },
  id: { code: 'id', shortLabel: 'ID', nativeName: 'Bahasa Indonesia', flagEmoji: '🇮🇩' },
  'pt-BR': { code: 'pt-BR', shortLabel: 'PT', nativeName: 'Português', flagEmoji: '🇧🇷' },
  ja: { code: 'ja', shortLabel: 'JA', nativeName: '日本語', flagEmoji: '🇯🇵' },
};
