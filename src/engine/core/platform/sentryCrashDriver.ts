import { initInBackground } from './platformServices.ts';
import type { CrashDriver } from './platformServices.ts';

export type SentryConfig = {
  dsn: string;
  release: string;
  environment: string;
  /** Tag gắn vào mọi sự kiện (vd. platform), để lọc trên dashboard Sentry. */
  tags?: Record<string, string>;
  /** Gốc URL của code game (vd. `https://localhost` trong app Android). Lỗi có stack mà không frame nào từ đây thì bỏ. */
  appOrigin?: string;
};

/** Lỗi nhiễu đã biết, không do game gây ra và không sửa được. Chỉ thêm khi đã xác minh trên dashboard. */
export const IGNORED_ERRORS: (string | RegExp)[] = [
  /ResizeObserver loop/,
  'Non-Error promise rejection captured',
  /^Script error\.?$/,
];

/** Script của extension trình duyệt (bản web). */
export const DENIED_URLS: RegExp[] = [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//];

export const MAX_BREADCRUMBS = 30;

type Crumb = { category?: string; level?: string };

/**
 * Bỏ breadcrumb không giúp gì cho game: click (game chỉ có một canvas), request mạng (toàn của SDK quảng cáo /
 * analytics, có thể lộ URL) và `console.log`. Giữ breadcrumb của game, điều hướng và console warn/error.
 */
export function keepBreadcrumb(crumb: Crumb): boolean {
  const { category, level } = crumb;
  if (category === 'ui.click' || category === 'ui.input' || category === 'fetch' || category === 'xhr') return false;
  if (category === 'console') return level === 'warning' || level === 'error';
  return true;
}

type SentryEventLike = {
  exception?: { values?: { stacktrace?: { frames?: { filename?: string }[] } }[] };
};

/** Có stack mà không frame nào thuộc code game thì lỗi đến từ nơi khác (extension, script lạ): bỏ. Không có stack thì giữ. */
export function isFromApp(event: SentryEventLike, appOrigin: string | undefined): boolean {
  if (!appOrigin) return true;
  const frames = (event.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? []);
  const files = frames.map((f) => f.filename).filter((f): f is string => !!f);
  if (files.length === 0) return true;
  return files.some((f) => f.startsWith(appOrigin));
}

/** Phần của `@sentry/browser` mà game dùng; giữ hẹp để test thay bằng đồ giả. */
export type SentryLike = {
  init(options: Record<string, unknown>): unknown;
  captureException(
    error: unknown,
    hint?: { extra?: Record<string, unknown>; mechanism?: { handled: boolean; type: string } }
  ): unknown;
  addBreadcrumb(breadcrumb: { message: string; category: string }): unknown;
  setTag(key: string, value: string): unknown;
  close(timeout?: number): unknown;
};

/** Đồng ý báo lỗi do game quyết định; engine chỉ cần biết bật hay tắt và khi nào đổi. */
export type ConsentGate = { enabled(): boolean; onChange(listener: (enabled: boolean) => void): () => void };

export const ALWAYS_ON: ConsentGate = { enabled: () => true, onChange: () => () => {} };

/**
 * Sentry nạp bằng `import()` động và khởi tạo ở nền (`initInBackground`): gói Sentry nằm ở chunk riêng, không
 * nằm trên đường boot. Tải xong thì các lệnh đang chờ chạy tiếp theo đúng thứ tự; tải hỏng hay treo quá
 * hạn thì mọi lệnh thành no-op. Mọi lỗi nuốt ở `createCrashReporter`. Có `gate` thì chỉ khởi tạo khi được đồng ý;
 * rút lại thì `close()` và mọi lệnh sau là no-op; bật lại thì khởi tạo lần nữa.
 */
export function createSentryCrashDriver(
  config: SentryConfig,
  load: () => Promise<SentryLike> = () => import('@sentry/browser') as unknown as Promise<SentryLike>,
  gate: ConsentGate = ALWAYS_ON
): CrashDriver {
  let ready: Promise<SentryLike | null> | null = null;
  /** Bản đã `init` thật sự, kể cả khi `initInBackground` đã quá hạn và trả null: rút lại phải đóng đúng bản này. */
  let live: SentryLike | null = null;

  const start = (): Promise<SentryLike | null> => {
    if (ready) return ready;
    const mine: Promise<SentryLike | null> = initInBackground('sentry', async () => {
      const sentry = await load();
      // Rút lại (hoặc rút rồi bật lại, đã có lượt khởi tạo khác) trong lúc SDK đang tải: không init.
      if (!gate.enabled() || ready !== mine) return null;
      sentry.init({
        dsn: config.dsn,
        release: config.release,
        environment: config.environment,
        sendDefaultPii: false,
        maxBreadcrumbs: MAX_BREADCRUMBS,
        ignoreErrors: IGNORED_ERRORS,
        denyUrls: DENIED_URLS,
        beforeBreadcrumb: (crumb: Crumb) => (keepBreadcrumb(crumb) ? crumb : null),
        beforeSend: (event: SentryEventLike) => (isFromApp(event, config.appOrigin) ? event : null),
        ...(config.tags ? { initialScope: { tags: config.tags } } : {}),
        // Lỗi toàn cục đã đi qua `installGlobalErrorHandlers`; tắt cái của Sentry để không báo hai lần.
        integrations: (defaults: { name: string }[]) => defaults.filter((i) => i.name !== 'GlobalHandlers'),
      });
      live = sentry;
      return sentry;
    });
    ready = mine;
    return mine;
  };

  /** Chỉ chạy lệnh khi đang được đồng ý; đang tắt thì bỏ, không xếp hàng. */
  const whenOn = (run: (sentry: SentryLike) => void): Promise<void> | undefined =>
    gate.enabled() ? start().then(() => void (live && gate.enabled() && run(live))) : undefined;

  if (gate.enabled()) void start();
  gate.onChange((on) => {
    if (on) {
      void start();
      return;
    }
    ready = null;
    const closing = live;
    live = null;
    // Nếu SDK còn đang tải, `ready !== mine` khiến lượt init đó tự bỏ; nếu đã init (kể cả sau hạn chờ) thì đóng ở đây.
    try {
      void closing?.close();
    } catch {
      // đóng hỏng: lệnh sau vẫn là no-op vì gate đã tắt
    }
  });

  return {
    capture: (error, context) =>
      whenOn((sentry) =>
        void sentry.captureException(error, {
          ...(context ? { extra: { ...context } } : {}),
          // Lỗi toàn cục là lỗi không ai bắt: để Sentry gắn nhãn "Unhandled" đúng như khi dùng handler của nó.
          ...(context?.source === 'window.onerror' || context?.source === 'unhandledrejection'
            ? { mechanism: { handled: false, type: `game.${String(context.source)}` } }
            : {}),
        })
      ),
    breadcrumb: (message) => whenOn((sentry) => void sentry.addBreadcrumb({ message, category: 'game' })),
    setContext: (key, value) => whenOn((sentry) => void sentry.setTag(key, String(value))),
  };
}
