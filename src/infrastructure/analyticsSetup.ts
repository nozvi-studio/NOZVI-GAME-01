import { createConsoleAnalyticsDriver } from './consoleAnalyticsDriver.ts';
import { createGameAnalyticsDriver } from './gameAnalyticsDriver.ts';
import type { AnalyticsPrivacy } from './gameAnalyticsDriver.ts';
import { loadGameAnalytics } from './gameAnalyticsSdk.ts';
import type { AnalyticsDriver } from '../engine/core/platform/platformServices.ts';

export type AnalyticsSelection = { driver: AnalyticsDriver | null; requiresConsent: boolean; warmUp?: () => void };

export type AnalyticsSelectionInput = {
  gameKey?: string;
  secretKey?: string;
  isNative: boolean;
  isDev: boolean;
  build: string;
  privacy: AnalyticsPrivacy;
};

/**
 * GameAnalytics chỉ bật trong app native khi đủ hai key; khi đó mục Thống kê được đưa vào màn đồng ý.
 * Còn lại: bản dev in console, bản release không có driver.
 */
export function selectAnalyticsDriver(input: AnalyticsSelectionInput): AnalyticsSelection {
  const { gameKey, secretKey, isNative, isDev, build, privacy } = input;
  if (gameKey && secretKey && isNative) {
    const driver = createGameAnalyticsDriver({ gameKey, secretKey, build }, loadGameAnalytics, privacy);
    return { driver, requiresConsent: true, warmUp: () => driver.warmUp() };
  }
  if (isDev) return { driver: createConsoleAnalyticsDriver(), requiresConsent: false };
  return { driver: null, requiresConsent: false };
}
