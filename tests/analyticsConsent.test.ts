import { describe, expect, test } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  grantAnalyticsConsent,
  isAnalyticsConsentGranted,
  type ConsentStore,
} from '../src/infrastructure/analyticsConsent.ts';

function fakeStore(): ConsentStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('analyticsConsent', () => {
  test('chưa lưu gì thì chưa đồng ý', () => {
    expect(isAnalyticsConsentGranted(fakeStore())).toBe(false);
  });

  test('grant ghi cờ và các lần đọc sau thấy đã đồng ý', () => {
    const store = fakeStore();
    grantAnalyticsConsent(store);
    expect(store.data.get(ANALYTICS_CONSENT_KEY)).toBe('granted');
    expect(isAnalyticsConsentGranted(store)).toBe(true);
  });

  test('giá trị lạ trong storage không được coi là đồng ý', () => {
    const store = fakeStore();
    store.setItem(ANALYTICS_CONSENT_KEY, 'true');
    expect(isAnalyticsConsentGranted(store)).toBe(false);
  });

  test('storage ném lỗi thì đọc trả về false và ghi không ném', () => {
    const broken: ConsentStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isAnalyticsConsentGranted(broken)).toBe(false);
    expect(() => grantAnalyticsConsent(broken)).not.toThrow();
  });
});
