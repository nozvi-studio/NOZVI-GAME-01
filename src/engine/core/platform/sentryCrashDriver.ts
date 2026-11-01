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
};

/**
 * Sentry nạp bằng `import()` động và khởi tạo ở nền (`initInBackground`): gói Sentry nằm ở chunk riêng, không
 * nằm trên đường boot. Tải xong thì các lệnh đang chờ chạy tiếp theo đúng thứ tự; tải hỏng hay treo quá
 * hạn thì mọi lệnh thành no-op. Mọi lỗi nuốt ở `createCrashReporter`.
 */
export function createSentryCrashDriver(
  config: SentryConfig,
  load: () => Promise<SentryLike> = () => import('@sentry/browser') as unknown as Promise<SentryLike>
): CrashDriver {
  const ready = initInBackground('sentry', async () => {
    const sentry = await load();
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
    return sentry;
  });

  return {
    capture: (error, context) =>
      ready.then(
        (sentry) =>
          void sentry?.captureException(error, {
            ...(context ? { extra: { ...context } } : {}),
            // Lỗi toàn cục là lỗi không ai bắt: để Sentry gắn nhãn "Unhandled" đúng như khi dùng handler của nó.
            ...(context?.source === 'window.onerror' || context?.source === 'unhandledrejection'
              ? { mechanism: { handled: false, type: `game.${String(context.source)}` } }
              : {}),
          })
      ),
    breadcrumb: (message) =>
      ready.then((sentry) => void sentry?.addBreadcrumb({ message, category: 'game' })),
    setContext: (key, value) => ready.then((sentry) => void sentry?.setTag(key, String(value))),
  };
}
