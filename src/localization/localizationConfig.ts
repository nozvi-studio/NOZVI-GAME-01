import type { LocaleMetadata, SupportedLocale } from './types.ts';

export const localizationConfig = {
  defaultLocale: 'en-US' as const,
  supportedLocales: ['en-US', 'es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'id', 'vi'] as const,
  allowManualLanguageSelection: true,
  persistSelectedLocale: true,
  fallbackLocale: 'en-US' as const,
  storageKey: 'nozvi.locale',
};

export const LOCALE_REGISTRY: Readonly<Record<SupportedLocale, LocaleMetadata>> = {
  'en-US': { code: 'en-US', shortLabel: 'EN', nativeName: 'English', flagEmoji: '🇺🇸' },
  es: { code: 'es', shortLabel: 'ES', nativeName: 'Español', flagEmoji: '🇪🇸' },
  'pt-BR': { code: 'pt-BR', shortLabel: 'PT', nativeName: 'Português', flagEmoji: '🇧🇷' },
  fr: { code: 'fr', shortLabel: 'FR', nativeName: 'Français', flagEmoji: '🇫🇷' },
  de: { code: 'de', shortLabel: 'DE', nativeName: 'Deutsch', flagEmoji: '🇩🇪' },
  ja: { code: 'ja', shortLabel: 'JA', nativeName: '日本語', flagEmoji: '🇯🇵' },
  ko: { code: 'ko', shortLabel: 'KO', nativeName: '한국어', flagEmoji: '🇰🇷' },
  'zh-CN': { code: 'zh-CN', shortLabel: 'ZH', nativeName: '简体中文', flagEmoji: '🇨🇳' },
  id: { code: 'id', shortLabel: 'ID', nativeName: 'Bahasa Indonesia', flagEmoji: '🇮🇩' },
  vi: { code: 'vi', shortLabel: 'VI', nativeName: 'Tiếng Việt', flagEmoji: '🇻🇳' },
};
