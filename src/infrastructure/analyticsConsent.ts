import { getSafeStorage, memoryStorage } from '../engine/core/platform/safeStorage.ts';

export const ANALYTICS_CONSENT_KEY = 'nozvi.analytics.consent.v1';

export type ConsentStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Không có localStorage thì dùng bộ nhớ chung: người chơi đã đồng ý trong phiên không bị hỏi lại. */
function defaultStore(): ConsentStore {
  return getSafeStorage() ?? memoryStorage;
}

export function isAnalyticsConsentGranted(store: ConsentStore = defaultStore()): boolean {
  try {
    return store.getItem(ANALYTICS_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function grantAnalyticsConsent(store: ConsentStore = defaultStore()): void {
  try {
    store.setItem(ANALYTICS_CONSENT_KEY, 'granted');
  } catch {
    // Không ghi được thì lần mở sau hỏi lại; không chặn game.
  }
}
