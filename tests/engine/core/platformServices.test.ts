import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createAnalytics,
  createCrashReporter,
  createPlatformServices,
  installGlobalErrorHandlers,
} from '../../../src/engine/core/platform/platformServices.ts';
import type { AnalyticsDriver, CrashDriver } from '../../../src/engine/core/platform/platformServices.ts';
import type { TelemetryEvent } from '../../../src/engine/core/platform/telemetry.ts';

const EVENT: TelemetryEvent = { type: 'level_start', levelId: '1-1', timestamp: 1 };

afterEach(() => vi.restoreAllMocks());

describe('CrashReporterPort', () => {
  test('chuyển capture, breadcrumb, setContext cho driver', () => {
    const calls: string[] = [];
    const driver: CrashDriver = {
      capture: (e, ctx) => void calls.push(`capture:${String(e)}:${JSON.stringify(ctx)}`),
      breadcrumb: (m) => void calls.push(`crumb:${m}`),
      setContext: (k, v) => void calls.push(`ctx:${k}=${v}`),
    };
    const port = createCrashReporter(driver);
    port.capture('x', { level: '1-1' });
    port.breadcrumb('drop');
    port.setContext('locale', 'vi');
    expect(calls).toEqual(['capture:x:{"level":"1-1"}', 'crumb:drop', 'ctx:locale=vi']);
  });

  test.each(['throw', 'reject'] as const)('driver %s không làm hỏng game', (mode) => {
    const fail = () => (mode === 'throw' ? (() => { throw new Error('sdk'); })() : Promise.reject(new Error('sdk')));
    const port = createCrashReporter({ capture: fail, breadcrumb: fail, setContext: fail });
    expect(() => {
      port.capture(new Error('a'));
      port.breadcrumb('b');
      port.setContext('k', 1);
    }).not.toThrow();
  });

  test('không có driver hoặc driver thiếu hàm tuỳ chọn thì là no-op', () => {
    for (const port of [createCrashReporter(null), createCrashReporter(undefined), createCrashReporter({ capture: () => {} })]) {
      expect(() => {
        port.capture(new Error('a'));
        port.breadcrumb('b');
        port.setContext('k', true);
      }).not.toThrow();
    }
  });
});

describe('AnalyticsPort', () => {
  test('chuyển sự kiện cho driver', () => {
    const seen: TelemetryEvent[] = [];
    createAnalytics({ track: (e) => void seen.push(e) }).track(EVENT);
    expect(seen).toEqual([EVENT]);
  });

  test.each(['throw', 'reject'] as const)('driver %s không làm hỏng game', (mode) => {
    const driver: AnalyticsDriver = {
      track: () => (mode === 'throw' ? (() => { throw new Error('sdk'); })() : Promise.reject(new Error('sdk'))),
    };
    expect(() => createAnalytics(driver).track(EVENT)).not.toThrow();
  });

  test('createPlatformServices không driver là no-op', () => {
    const p = createPlatformServices();
    expect(() => {
      p.crash.capture('x');
      p.analytics.track(EVENT);
    }).not.toThrow();
  });
});

describe('installGlobalErrorHandlers', () => {
  function fakeTarget() {
    const handlers = new Map<string, (e: unknown) => void>();
    return {
      target: { addEventListener: (type: string, fn: (e: unknown) => void) => void handlers.set(type, fn) } as Pick<
        Window,
        'addEventListener'
      >,
      fire: (type: string, event: unknown) => handlers.get(type)!(event),
    };
  }

  test('log ra console rồi chuyển cho crash reporter', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const captured: unknown[] = [];
    const { target, fire } = fakeTarget();
    installGlobalErrorHandlers(target, {
      capture: (e, ctx) => void captured.push([e, ctx]),
      breadcrumb: () => {},
      setContext: () => {},
    });
    const err = new Error('boom');
    fire('error', { error: err, message: 'boom' });
    fire('unhandledrejection', { reason: 'nope' });
    expect(logged).toHaveBeenCalledTimes(2);
    expect(captured).toEqual([
      [err, { source: 'window.onerror' }],
      ['nope', { source: 'unhandledrejection' }],
    ]);
  });

  test('dùng message khi event không có error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const captured: unknown[] = [];
    const { target, fire } = fakeTarget();
    installGlobalErrorHandlers(target, createCrashReporter({ capture: (e) => void captured.push(e) }));
    fire('error', { message: 'Script error.' });
    expect(captured).toEqual(['Script error.']);
  });
});
