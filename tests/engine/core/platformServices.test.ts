import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createAnalytics,
  createCrashReporter,
  createPlatformServices,
  initInBackground,
  installGlobalErrorHandlers,
} from '../../../src/engine/core/platform/platformServices.ts';
import type { AnalyticsDriver, CrashDriver } from '../../../src/engine/core/platform/platformServices.ts';
import type { TelemetryEvent } from '../../../src/engine/core/platform/telemetry.ts';

const EVENT: TelemetryEvent = { type: 'level_start', levelId: '1-1', timestamp: 1 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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
  test('track chỉ xếp hàng; driver được gọi khi flush', () => {
    const seen: TelemetryEvent[] = [];
    const port = createAnalytics({ track: (e) => void seen.push(e) }, { schedule: () => {} });
    port.track(EVENT);
    expect(seen).toEqual([]);
    port.flush();
    expect(seen).toEqual([EVENT]);
  });

  test.each(['throw', 'reject'] as const)('driver %s không làm hỏng game', (mode) => {
    const driver: AnalyticsDriver = {
      track: () => (mode === 'throw' ? (() => { throw new Error('sdk'); })() : Promise.reject(new Error('sdk'))),
    };
    const port = createAnalytics(driver, { schedule: () => {} });
    port.track(EVENT);
    expect(() => port.flush()).not.toThrow();
  });

  test('createPlatformServices không driver là no-op', () => {
    const p = createPlatformServices();
    expect(() => {
      p.crash.capture('x');
      p.analytics.track(EVENT);
      p.analytics.flush();
    }).not.toThrow();
  });

  test('tự gửi sau flushMs, theo lô, và chỉ hẹn giờ một lần', () => {
    const seen: TelemetryEvent[] = [];
    const timers: Array<() => void> = [];
    const port = createAnalytics({ track: (e) => void seen.push(e) }, { schedule: (run) => void timers.push(run) });
    port.track(EVENT);
    port.track({ ...EVENT, levelId: '1-2' });
    expect(timers).toHaveLength(1);
    expect(seen).toEqual([]);
    timers[0]();
    expect(seen.map((e) => (e as { levelId: string }).levelId)).toEqual(['1-1', '1-2']);
    port.track(EVENT);
    expect(timers).toHaveLength(2);
  });

  test('vượt maxQueue thì bỏ sự kiện cũ nhất', () => {
    const seen: string[] = [];
    const port = createAnalytics(
      { track: (e) => void seen.push((e as { levelId: string }).levelId) },
      { maxQueue: 2, schedule: () => {} }
    );
    for (const id of ['a', 'b', 'c']) port.track({ ...EVENT, levelId: id });
    port.flush();
    expect(seen).toEqual(['b', 'c']);
  });
});

describe('createCrashReporter chống bão lỗi', () => {
  const clock = (start = 0) => {
    let t = start;
    return { now: () => t, advance: (ms: number) => void (t += ms) };
  };

  test('bỏ báo cáo trùng trong cùng cửa sổ, cho qua lại sau cửa sổ', () => {
    const c = clock();
    const seen: unknown[] = [];
    const port = createCrashReporter({ capture: (e) => void seen.push(e) }, { now: c.now, windowMs: 1000 });
    port.capture('same');
    port.capture('same');
    port.capture('other');
    expect(seen).toEqual(['same', 'other']);
    c.advance(1000);
    port.capture('same');
    expect(seen).toEqual(['same', 'other', 'same']);
  });

  test('giới hạn số báo cáo mỗi cửa sổ', () => {
    const seen: unknown[] = [];
    const port = createCrashReporter({ capture: (e) => void seen.push(e) }, { maxPerWindow: 3, now: () => 0 });
    for (let i = 0; i < 50; i++) port.capture(`e${i}`);
    expect(seen).toHaveLength(3);
  });

  test('giới hạn breadcrumb mỗi cửa sổ', () => {
    let n = 0;
    const port = createCrashReporter(
      { capture: () => {}, breadcrumb: () => void (n += 1) },
      { maxBreadcrumbsPerWindow: 5, now: () => 0 }
    );
    for (let i = 0; i < 50; i++) port.breadcrumb('x');
    expect(n).toBe(5);
  });

  test('driver tự gây lỗi lại vào capture thì không lặp vô hạn', () => {
    let calls = 0;
    const holder: { port?: ReturnType<typeof createCrashReporter> } = {};
    holder.port = createCrashReporter({
      capture: () => {
        calls += 1;
        holder.port!.capture(new Error(`again ${calls}`));
      },
    });
    holder.port.capture(new Error('first'));
    expect(calls).toBe(1);
  });
});

describe('initInBackground', () => {
  test('trả về giá trị khi init xong', async () => {
    await expect(initInBackground('x', async () => 42)).resolves.toBe(42);
  });

  test('init reject hoặc ném đồng bộ thì trả null, không reject', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initInBackground('x', () => Promise.reject(new Error('no')))).resolves.toBeNull();
    await expect(
      initInBackground('x', () => {
        throw new Error('sync');
      })
    ).resolves.toBeNull();
  });

  test('init treo vĩnh viễn thì trả null sau timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = initInBackground('x', () => new Promise<never>(() => {}), 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(result).resolves.toBeNull();
  });

  test('init xong sau timeout bị bỏ qua', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let late!: (v: string) => void;
    const result = initInBackground('x', () => new Promise<string>((r) => (late = r)), 100);
    await vi.advanceTimersByTimeAsync(100);
    late('muộn');
    await expect(result).resolves.toBeNull();
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
