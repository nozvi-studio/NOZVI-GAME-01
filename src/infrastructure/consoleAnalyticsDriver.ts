import type { AnalyticsDriver } from '../engine/core/platform/platformServices.ts';

/** Driver để xem sự kiện thật khi chơi thử: chỉ in ra console, không gửi đi đâu. */
export function createConsoleAnalyticsDriver(
  log: (...args: unknown[]) => void = (...args) => console.info(...args)
): AnalyticsDriver {
  return {
    track(event) {
      const levelId = 'levelId' in event ? ` ${event.levelId}` : '';
      log(`[analytics] ${event.type}${levelId}`, event);
    },
  };
}
