import { createConsoleAnalyticsDriver } from './consoleAnalyticsDriver.ts';
import { createGameAnalyticsDriver } from './gameAnalyticsDriver.ts';
import { loadGameAnalytics } from './gameAnalyticsSdk.ts';
import type { AnalyticsDriver } from './platformServices.ts';

export type AnalyticsSelection = { driver: AnalyticsDriver | null; requiresConsent: boolean; warmUp?: () => void };

export type AnalyticsSelectionInput = {
  gameKey?: string;
  secretKey?: string;
  isNative: boolean;
  isDev: boolean;
  build: string;
};

/**
 * GameAnalytics chỉ bật trong app native khi đủ hai key; khi đó game phải xin consent trước khi vào.
 * Còn lại: bản dev in console, bản release không có driver.
 */
export function selectAnalyticsDriver(input: AnalyticsSelectionInput): AnalyticsSelection {
  const { gameKey, secretKey, isNative, isDev, build } = input;
  if (gameKey && secretKey && isNative) {
    const driver = createGameAnalyticsDriver({ gameKey, secretKey, build }, loadGameAnalytics);
    return { driver, requiresConsent: true, warmUp: () => driver.warmUp() };
  }
  if (isDev) return { driver: createConsoleAnalyticsDriver(), requiresConsent: false };
  return { driver: null, requiresConsent: false };
}
