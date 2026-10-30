import { initInBackground } from './platformServices.ts';
import type { CrashDriver } from './platformServices.ts';

export type SentryConfig = {
  dsn: string;
  release: string;
  environment: string;
  /** Tag gắn vào mọi sự kiện (vd. platform), để lọc trên dashboard Sentry. */
  tags?: Record<string, string>;
};

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
