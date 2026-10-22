import { afterEach, describe, expect, it } from 'vitest';
import { setFontLocale, TYPO_TOKENS } from '../src/presentation/designTokens.ts';

const firstCjk = (stack: string): string =>
  stack.split(',').map((f) => f.trim().replace(/'/g, '')).find((f) => /Hiragino|Apple SD|PingFang/.test(f)) ?? '';

const index = (stack: string, font: string): number => stack.indexOf(`'${font}'`);

describe('CJK font stack follows the active locale', () => {
  afterEach(() => setFontLocale('ja'));

  it('puts Simplified Chinese fonts before Japanese ones for zh-CN', () => {
    setFontLocale('zh-CN');
    for (const key of ['display', 'serif', 'sans', 'levelTitle'] as const) {
      const stack = TYPO_TOKENS.fontFamily[key];
      expect(index(stack, 'PingFang SC'), key).toBeGreaterThan(-1);
      expect(index(stack, 'PingFang SC'), key).toBeLessThan(index(stack, 'Yu Gothic'));
      expect(index(stack, 'Microsoft YaHei'), key).toBeLessThan(index(stack, 'Meiryo'));
    }
  });

  it('puts Korean fonts first for ko and Japanese fonts first for ja and Latin locales', () => {
    setFontLocale('ko');
    expect(firstCjk(TYPO_TOKENS.fontFamily.display)).toBe('Apple SD Gothic Neo');
    setFontLocale('ja');
    expect(firstCjk(TYPO_TOKENS.fontFamily.display)).toBe('Hiragino Sans');
    setFontLocale('fr');
    expect(firstCjk(TYPO_TOKENS.fontFamily.display)).toBe('Hiragino Sans');
  });

  it('keeps the Latin/Vietnamese primary family first for every locale', () => {
    for (const locale of ['zh-CN', 'ko', 'ja', 'vi']) {
      setFontLocale(locale);
      expect(TYPO_TOKENS.fontFamily.display.startsWith("'Baloo 2'")).toBe(true);
      expect(TYPO_TOKENS.fontFamily.sans.startsWith("'Be Vietnam Pro'")).toBe(true);
    }
  });
});
