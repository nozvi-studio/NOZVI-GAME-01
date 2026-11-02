import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createSentryCrashDriver,
  isFromApp,
  keepBreadcrumb,
  MAX_BREADCRUMBS,
} from '../src/engine/core/platform/sentryCrashDriver.ts';
import type { ConsentGate, SentryConfig, SentryLike } from '../src/engine/core/platform/sentryCrashDriver.ts';
import { createCrashReporter } from '../src/engine/core/platform/platformServices.ts';
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
    captureException: (e, hint) =>
      void log.push(
        `capture:${(e as Error).message}:${JSON.stringify(hint?.extra ?? null)}${hint?.mechanism ? `:handled=${hint.mechanism.handled}` : ''}`
      ),
    addBreadcrumb: (b) => void log.push(`crumb:${b.message}:${b.category}`),
    setTag: (k, v) => void log.push(`tag:${k}=${v}`),
    close: () => void log.push('close'),
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

  test('tag cấu hình được đưa vào initialScope, không có tag thì không thêm initialScope', async () => {
    const withTags = fakeSentry();
    await createSentryCrashDriver({ ...CONFIG, tags: { platform: 'android' } }, async () => withTags.sentry).capture(new Error('x'));
    expect(withTags.options()).toMatchObject({ initialScope: { tags: { platform: 'android' } } });

    const without = fakeSentry();
    await createSentryCrashDriver(CONFIG, async () => without.sentry).capture(new Error('x'));
    expect(without.options()).not.toHaveProperty('initialScope');
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

describe('mechanism của lỗi toàn cục', () => {
  test('lỗi window.onerror / unhandledrejection được gắn handled=false, lỗi thủ công thì không', async () => {
    const f = fakeSentry();
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry);
    await driver.capture(new Error('a'), { source: 'window.onerror' });
    await driver.capture(new Error('b'), { source: 'unhandledrejection' });
    await driver.capture(new Error('c'), { source: 'crash-test' });
    expect(f.log.filter((l) => l.startsWith('capture'))).toEqual([
      'capture:a:{"source":"window.onerror"}:handled=false',
      'capture:b:{"source":"unhandledrejection"}:handled=false',
      'capture:c:{"source":"crash-test"}',
    ]);
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

describe('lọc lỗi và breadcrumb', () => {
  test('init có giới hạn breadcrumb, ignoreErrors, denyUrls và các hook lọc', async () => {
    const f = fakeSentry();
    await createSentryCrashDriver(CONFIG, async () => f.sentry).capture(new Error('x'));
    const o = f.options();
    expect(o.maxBreadcrumbs).toBe(MAX_BREADCRUMBS);
    expect(o.ignoreErrors).toEqual(expect.arrayContaining(['Non-Error promise rejection captured']));
    expect((o.denyUrls as RegExp[]).some((r) => r.test('chrome-extension://abc/x.js'))).toBe(true);
    expect(typeof o.beforeSend).toBe('function');
    expect(typeof o.beforeBreadcrumb).toBe('function');
  });

  test('keepBreadcrumb bỏ click, request mạng và console.log; giữ game, điều hướng, warn/error', () => {
    expect(keepBreadcrumb({ category: 'ui.click' })).toBe(false);
    expect(keepBreadcrumb({ category: 'fetch' })).toBe(false);
    expect(keepBreadcrumb({ category: 'xhr' })).toBe(false);
    expect(keepBreadcrumb({ category: 'console', level: 'log' })).toBe(false);
    expect(keepBreadcrumb({ category: 'console', level: 'warning' })).toBe(true);
    expect(keepBreadcrumb({ category: 'console', level: 'error' })).toBe(true);
    expect(keepBreadcrumb({ category: 'game' })).toBe(true);
    expect(keepBreadcrumb({ category: 'navigation' })).toBe(true);
  });

  test('isFromApp bỏ lỗi có stack hoàn toàn ngoài code game', () => {
    const ev = (...files: string[]) => ({ exception: { values: [{ stacktrace: { frames: files.map((filename) => ({ filename })) } }] } });
    const origin = 'https://localhost';
    expect(isFromApp(ev('https://localhost/assets/index-abc.js'), origin)).toBe(true);
    expect(isFromApp(ev('chrome-extension://x/a.js', 'https://localhost/assets/a.js'), origin)).toBe(true);
    expect(isFromApp(ev('chrome-extension://x/a.js'), origin)).toBe(false);
    expect(isFromApp({}, origin)).toBe(true);
    expect(isFromApp(ev('https://other.com/a.js'), undefined)).toBe(true);
  });

  test('beforeSend trả null cho lỗi ngoài game, giữ lỗi của game', async () => {
    const f = fakeSentry();
    await createSentryCrashDriver({ ...CONFIG, appOrigin: 'https://localhost' }, async () => f.sentry).capture(new Error('x'));
    const beforeSend = f.options().beforeSend as (e: unknown) => unknown;
    const app = { exception: { values: [{ stacktrace: { frames: [{ filename: 'https://localhost/a.js' }] } }] } };
    const foreign = { exception: { values: [{ stacktrace: { frames: [{ filename: 'https://ads.example/x.js' }] } }] } };
    expect(beforeSend(app)).toBe(app);
    expect(beforeSend(foreign)).toBeNull();
  });
});

function gate(initial: boolean) {
  let on = initial;
  const listeners = new Set<(v: boolean) => void>();
  const g: ConsentGate = {
    enabled: () => on,
    onChange: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
  return {
    g,
    set(v: boolean) {
      on = v;
      for (const l of listeners) l(v);
    },
  };
}

describe('Sentry theo đồng ý báo lỗi', () => {
  test('chưa đồng ý: không init, mọi lệnh là no-op', async () => {
    const f = fakeSentry();
    const c = gate(false);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    await driver.capture(new Error('a'));
    await driver.breadcrumb?.('b');
    await driver.setContext?.('k', 1);
    expect(f.log).toEqual([]);
  });

  test('đồng ý thì init ngay (để có session) rồi gửi', async () => {
    const f = fakeSentry();
    const c = gate(false);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    c.set(true);
    await vi.waitFor(() => expect(f.log).toContain('init'));
    await driver.capture(new Error('x'));
    expect(f.log.filter((l) => l.startsWith('capture'))).toHaveLength(1);
  });

  test('rút lại thì close và lệnh sau là no-op; bật lại thì init lần nữa', async () => {
    const f = fakeSentry();
    const c = gate(true);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    await driver.capture(new Error('one'));
    c.set(false);
    await vi.waitFor(() => expect(f.log).toContain('close'));
    await driver.capture(new Error('two'));
    expect(f.log.some((l) => l.startsWith('capture:two'))).toBe(false);
    c.set(true);
    await vi.waitFor(() => expect(f.log.filter((l) => l === 'init')).toHaveLength(2));
  });

  test('rút lại khi SDK còn đang tải thì không init', async () => {
    const f = fakeSentry();
    const c = gate(true);
    let release!: (s: SentryLike) => void;
    const driver = createSentryCrashDriver(CONFIG, () => new Promise<SentryLike>((r) => (release = r)), c.g);
    c.set(false);
    release(f.sentry);
    await driver.capture(new Error('late'));
    await new Promise((r) => setTimeout(r, 0));
    expect(f.log).not.toContain('init');
    expect(f.log.some((l) => l.startsWith('capture'))).toBe(false);
  });

  test('SDK nạp xong sau hạn chờ rồi rút lại: vẫn close bản đã init', async () => {
    vi.useFakeTimers();
    const f = fakeSentry();
    const c = gate(true);
    let release!: (s: SentryLike) => void;
    createSentryCrashDriver(CONFIG, () => new Promise<SentryLike>((r) => (release = r)), c.g);
    await vi.advanceTimersByTimeAsync(9000);
    release(f.sentry);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.log).toContain('init');
    c.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.log).toContain('close');
  });
});
