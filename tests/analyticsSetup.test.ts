import { describe, expect, test } from 'vitest';
import { selectAnalyticsDriver } from '../src/infrastructure/analyticsSetup.ts';

const PRIVACY = { get: () => ({ analytics: false, diagnostics: false, ads: false }), userId: () => 'u', onChange: () => () => {} };
const KEYS = { gameKey: 'gk', secretKey: 'sk', build: '1.0.0' };

describe('selectAnalyticsDriver', () => {
  test('app native có đủ hai key thì dùng GameAnalytics và cần consent', () => {
    const out = selectAnalyticsDriver({ privacy: PRIVACY, ...KEYS, isNative: true, isDev: false });
    expect(out.driver).not.toBeNull();
    expect(out.requiresConsent).toBe(true);
    expect(typeof out.warmUp).toBe('function');
  });

  test('thiếu một key thì không có driver GameAnalytics', () => {
    const out = selectAnalyticsDriver({ privacy: PRIVACY, gameKey: 'gk', build: '1.0.0', isNative: true, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });

  test('web có đủ key vẫn không bật GameAnalytics', () => {
    const out = selectAnalyticsDriver({ privacy: PRIVACY, ...KEYS, isNative: false, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });

  test('web dev không key dùng driver console và không cần consent', () => {
    const out = selectAnalyticsDriver({ privacy: PRIVACY, build: '1.0.0', isNative: false, isDev: true });
    expect(out.driver).not.toBeNull();
    expect(out.requiresConsent).toBe(false);
  });

  test('bản release không key không có driver nào', () => {
    const out = selectAnalyticsDriver({ privacy: PRIVACY, build: '1.0.0', isNative: false, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });
});
