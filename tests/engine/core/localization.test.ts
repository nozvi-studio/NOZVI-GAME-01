import { describe, expect, test, vi } from 'vitest';
import { interpolate, Localization } from '../../../src/engine/core/localization/Localization.ts';

type L = 'en' | 'vi';
const bundles: Record<L, { hello: string }> = { en: { hello: 'Hello' }, vi: { hello: 'Xin chào' } };

describe('Localization', () => {
  test('starts on the initial locale and reads its bundle', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'vi');
    expect(loc.locale).toBe('vi');
    expect(loc.bundle().hello).toBe('Xin chào');
    expect(loc.bundle('en').hello).toBe('Hello');
  });

  test('set switches the locale, persists it, then notifies listeners, in that order', () => {
    const log: string[] = [];
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en', (locale) => log.push(`persist:${locale}`));
    loc.onChange((locale) => log.push(`listener:${locale}`));
    expect(loc.set('vi')).toBe(true);
    expect(loc.locale).toBe('vi');
    expect(log).toEqual(['persist:vi', 'listener:vi']);
  });

  test('set is silent for the current locale and for an unknown one', () => {
    const persist = vi.fn();
    const listener = vi.fn();
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en', persist);
    loc.onChange(listener);
    expect(loc.set('en')).toBe(false);
    expect(loc.set('xx' as L)).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  test('bundle falls back for a locale that has none', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    expect(loc.bundle('xx' as L).hello).toBe('Hello');
  });

  test('isSupported tells known locales from unknown ones', () => {
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    expect(loc.isSupported('vi')).toBe(true);
    expect(loc.isSupported('toString')).toBe(false);
  });

  test('onChange returns an unsubscribe function', () => {
    const listener = vi.fn();
    const loc = new Localization<L, { hello: string }>(bundles, 'en', 'en');
    const off = loc.onChange(listener);
    off();
    loc.set('vi');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('interpolate', () => {
  test('fills every {name} placeholder, repeats included', () => {
    expect(interpolate('{a} and {a} and {b}', { a: 'x', b: 2 })).toBe('x and x and 2');
  });

  test('returns the text unchanged without params, and ignores unknown params', () => {
    expect(interpolate('plain {a}')).toBe('plain {a}');
    expect(interpolate('plain {a}', { b: 1 })).toBe('plain {a}');
  });
});
