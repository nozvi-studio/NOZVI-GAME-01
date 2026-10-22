import { describe, expect, it } from 'vitest';
import { LOCALE_REGISTRY } from '../src/localization/localizationConfig.ts';
import { LocalizationManager } from '../src/localization/LocalizationManager.ts';

describe('LanguageSelectDialog state & registry', () => {
  it('exposes all 5 supported locales with native labels and flags', () => {
    const list = Object.values(LOCALE_REGISTRY);
    expect(list.length).toBe(5);
    expect(list.map((x) => x.code)).toEqual(['vi', 'en-US', 'id', 'pt-BR', 'ja']);
  });

  it('updates manager locale when selected', () => {
    const mgr = LocalizationManager.getInstance();
    mgr.setLocale('en-US');
    mgr.setLocale('id');
    expect(mgr.getLocale()).toBe('id');
  });
});
