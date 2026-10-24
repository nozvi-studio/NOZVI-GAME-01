import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSentryCrashDriver } from '../src/infrastructure/sentryCrashDriver.ts';
import type { SentryConfig, SentryLike } from '../src/infrastructure/sentryCrashDriver.ts';
import { createCrashReporter } from '../src/infrastructure/platformServices.ts';
import { installCrashTest } from '../src/devtools/crashTest.ts';

const CONFIG: SentryConfig = { dsn: 'https://key@example.ingest.sentry.io/1', release: '1.0.0', environment: 'test' };

function fakeSentry() {
  const log: string[] = [];
  let initOptions: Record<string, unknown> = {};
  const sentry: SentryLike = {
    init: (o) => {
      initOptions = o;
      log.push('init');
    },
    captureException: (e, hint) => void log.push(`capture:${(e as Error).message}:${JSON.stringify(hint?.extra ?? null)}`),
    addBreadcrumb: (b) => void log.push(`crumb:${b.message}:${b.category}`),
    setTag: (k, v) => void log.push(`tag:${k}=${v}`),
  };
  return { sentry, log, options: () => initOptions };
}

afterEach(() => vi.useRealTimers());

describe('createSentryCrashDriver', () => {
  test('khởi tạo với release/environment, không gửi PII, tắt GlobalHandlers', async () => {
    const f = fakeSentry();
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry);
    await driver.capture(new Error('x'));
    const o = f.options();
    expect(o).toMatchObject({ dsn: CONFIG.dsn, release: '1.0.0', environment: 'test', sendDefaultPii: false });
    const integrations = o.integrations as (d: { name: string }[]) => { name: string }[];
    expect(integrations([{ name: 'GlobalHandlers' }, { name: 'Dedupe' }]).map((i) => i.name)).toEqual(['Dedupe']);
  });

  test('lệnh gọi trước khi Sentry tải xong chạy sau, đúng thứ tự', async () => {
    const f = fakeSentry();
    let release!: (s: SentryLike) => void;
    const driver = createSentryCrashDriver(CONFIG, () => new Promise<SentryLike>((r) => (release = r)));
    const port = createCrashReporter(driver);
    port.setContext('locale', 'vi');
    port.breadcrumb('drop');
    port.capture(new Error('boom'), { level: '1-1' });
    expect(f.log).toEqual([]);
    release(f.sentry);
    await vi.waitFor(() => expect(f.log).toHaveLength(4));
    expect(f.log).toEqual(['init', 'tag:locale=vi', 'crumb:drop:game', 'capture:boom:{"level":"1-1"}']);
  });

  test('Sentry tải hỏng thì mọi lệnh là no-op, game không bị ảnh hưởng', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = createCrashReporter(createSentryCrashDriver(CONFIG, () => Promise.reject(new Error('blocked'))));
    expect(() => {
      port.capture(new Error('a'));
      port.breadcrumb('b');
      port.setContext('k', 1);
    }).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  test('Sentry treo vĩnh viễn: lệnh gọi trả về ngay và hết hạn thành no-op', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const port = createCrashReporter(createSentryCrashDriver(CONFIG, () => new Promise<SentryLike>(() => {})));
    const started = performance.now();
    port.capture(new Error('a'));
    port.breadcrumb('b');
    expect(performance.now() - started).toBeLessThan(50);
    await vi.advanceTimersByTimeAsync(10_000);
  });

  test('Sentry.init ném lỗi thì nuốt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = fakeSentry();
    f.sentry.init = () => {
      throw new Error('bad dsn');
    };
    const port = createCrashReporter(createSentryCrashDriver(CONFIG, async () => f.sentry));
    expect(() => port.capture(new Error('a'))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(f.log).toEqual([]);
  });
});

describe('installCrashTest', () => {
  test('gắn __crashTest và kind capture gọi crash.capture', () => {
    const seen: unknown[] = [];
    const target: Record<string, unknown> = {};
    installCrashTest(target, {
      capture: (e, c) => void seen.push([(e as Error).message.startsWith('[crash-test]'), c]),
      breadcrumb() {},
      setContext() {},
    });
    (target.__crashTest as (k?: string) => void)('capture');
    expect(seen).toEqual([[true, { source: 'crash-test' }]]);
  });
});
