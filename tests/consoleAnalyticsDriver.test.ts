import { describe, expect, test } from 'vitest';
import { createConsoleAnalyticsDriver } from '../src/infrastructure/consoleAnalyticsDriver.ts';
import type { TelemetryEvent } from '../src/engine/core/platform/telemetry.ts';

const START: TelemetryEvent = { type: 'level_start', levelId: '1-1', chapter: 1, mode: 'campaign', timestamp: 1 };

describe('consoleAnalyticsDriver', () => {
  test('in mỗi sự kiện với tiền tố analytics, loại sự kiện và chính sự kiện đó', () => {
    const lines: unknown[][] = [];
    const driver = createConsoleAnalyticsDriver((...args) => void lines.push(args));
    driver.track(START);
    expect(lines).toEqual([['[analytics] level_start 1-1', START]]);
  });

  test('sự kiện không có levelId vẫn in được', () => {
    const lines: unknown[][] = [];
    const driver = createConsoleAnalyticsDriver((...args) => void lines.push(args));
    const event: TelemetryEvent = { type: 'session_start', sessionId: 's1', timestamp: 2 };
    driver.track(event);
    expect(lines).toEqual([['[analytics] session_start', event]]);
  });
});
