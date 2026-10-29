import type {
  AdsPort,
  AnalyticsPort,
  CrashContext,
  CrashReporterPort,
  CrashValue,
  PlatformServices,
  RewardedOutcome,
} from '../application/platformPort.ts';
import type { TelemetryEvent } from '../application/telemetry.ts';

/** Điểm cắm cho SDK ngoài. Driver được phép ném lỗi hoặc reject: lớp bọc dưới đây nuốt hết. */
export type CrashDriver = {
  capture(error: unknown, context?: CrashContext): void | Promise<void>;
  breadcrumb?(message: string): void | Promise<void>;
  setContext?(key: string, value: CrashValue): void | Promise<void>;
};

export type AnalyticsDriver = {
  track(event: TelemetryEvent): void | Promise<void>;
};

export type AdsDriver = {
  init(): Promise<void>;
  showBanner(): void | Promise<void>;
  hideBanner(): void | Promise<void>;
  showRewarded(): Promise<RewardedOutcome>;
  rewardedReady(): boolean;
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
};

export type PlatformDrivers = {
  crash?: CrashDriver | null;
  analytics?: AnalyticsDriver | null;
  ads?: AdsDriver | null;
};

/** SDK ngoài chỉ là phụ: mọi lỗi (thiếu SDK, mạng, bị chặn trong iframe) bị nuốt im lặng. */
function safely(run: () => void | Promise<void>): void {
  try {
    const result = run();
    if (result) result.catch(() => {});
  } catch {
    // driver ném đồng bộ
  }
}

/**
 * Khởi tạo SDK ngoài ở nền. Không bao giờ reject và không bao giờ chờ quá `timeoutMs`: treo hay lỗi thì
 * trả null và driver tương ứng đứng yên, game vẫn lên. Gọi hàm này KHÔNG `await` trên đường boot.
 */
export function initInBackground<T>(name: string, init: () => Promise<T>, timeoutMs = 8000): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T | null, why?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (why) console.warn(`[platform] ${name} ${why}`);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null, 'init timed out'), timeoutMs);
    try {
      init().then(
        (value) => finish(value),
        () => finish(null, 'init failed')
      );
    } catch {
      finish(null, 'init failed');
    }
  });
}

export type CrashGuardOptions = {
  /** Số báo cáo tối đa mỗi cửa sổ thời gian; vượt thì bỏ. */
  maxPerWindow?: number;
  maxBreadcrumbsPerWindow?: number;
  windowMs?: number;
  now?: () => number;
};

function errorKey(error: unknown, context?: CrashContext): string {
  const text = error instanceof Error ? `${error.name}:${error.message}:${error.stack?.split('\n')[1] ?? ''}` : String(error);
  return `${context?.source ?? ''}|${text}`;
}

/**
 * Bảo vệ game khỏi chính crash reporter: giới hạn tần suất, bỏ báo cáo trùng trong cùng cửa sổ, và chặn vòng
 * lặp (SDK tự sinh lỗi -> handler toàn cục -> capture -> SDK lại sinh lỗi...).
 */
export function createCrashReporter(
  driver: CrashDriver | null | undefined,
  options: CrashGuardOptions = {}
): CrashReporterPort {
  const { maxPerWindow = 10, maxBreadcrumbsPerWindow = 100, windowMs = 60_000, now = Date.now } = options;
  let windowStart = now();
  let captured = 0;
  let crumbs = 0;
  let seen = new Set<string>();
  let busy = false;

  const roll = (): void => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      captured = 0;
      crumbs = 0;
      seen = new Set();
    }
  };

  return {
    capture(error, context) {
      if (!driver || busy) return;
      roll();
      const key = errorKey(error, context);
      if (captured >= maxPerWindow || seen.has(key)) return;
      seen.add(key);
      captured += 1;
      busy = true;
      try {
        safely(() => driver.capture(error, context));
      } finally {
        busy = false;
      }
    },
    breadcrumb(message) {
      if (!driver?.breadcrumb) return;
      roll();
      if (crumbs >= maxBreadcrumbsPerWindow) return;
      crumbs += 1;
      safely(() => driver.breadcrumb!(message));
    },
    setContext(key, value) {
      if (driver?.setContext) safely(() => driver.setContext!(key, value));
    },
  };
}

export type AnalyticsQueueOptions = {
  /** Quá số này thì bỏ sự kiện cũ nhất: SDK chậm không được làm bộ nhớ phình ra. */
  maxQueue?: number;
  flushMs?: number;
  schedule?: (run: () => void, ms: number) => unknown;
};

/**
 * `track` chỉ xếp hàng (rẻ, chạy ngay trong lúc kéo thả); driver được gọi sau đó, theo lô, ngoài đường nóng.
 */
export function createAnalytics(
  driver: AnalyticsDriver | null | undefined,
  options: AnalyticsQueueOptions = {}
): AnalyticsPort {
  const { maxQueue = 100, flushMs = 2000, schedule = (run, ms) => setTimeout(run, ms) } = options;
  let queue: TelemetryEvent[] = [];
  let armed = false;

  const flush = (): void => {
    armed = false;
    const batch = queue;
    queue = [];
    if (!driver) return;
    for (const event of batch) safely(() => driver.track(event));
  };

  return {
    track(event) {
      if (!driver) return;
      queue.push(event);
      if (queue.length > maxQueue) queue.shift();
      if (!armed) {
        armed = true;
        schedule(flush, flushMs);
      }
    },
    flush,
  };
}

export function createAds(driver: AdsDriver | null | undefined): AdsPort {
  return {
    async init() {
      if (!driver) return;
      try {
        await driver.init();
      } catch {
        // SDK lỗi: game chạy tiếp không quảng cáo
      }
    },
    showBanner() {
      if (driver) safely(() => driver.showBanner());
    },
    hideBanner() {
      if (driver) safely(() => driver.hideBanner());
    },
    async showRewarded() {
      if (!driver) return 'unavailable';
      try {
        return await driver.showRewarded();
      } catch {
        return 'unavailable';
      }
    },
    rewardedReady() {
      try {
        return driver?.rewardedReady() ?? false;
      } catch {
        return false;
      }
    },
    privacyOptionsRequired() {
      try {
        return driver?.privacyOptionsRequired() ?? false;
      } catch {
        return false;
      }
    },
    async showPrivacyOptions() {
      if (!driver) return;
      try {
        await driver.showPrivacyOptions();
      } catch {
        // form không mở được: bỏ qua
      }
    },
  };
}

/** Không truyền driver nào thì mọi lệnh là no-op: game chạy y hệt khi chưa gắn SDK. */
export function createPlatformServices(drivers: PlatformDrivers = {}): PlatformServices {
  return {
    crash: createCrashReporter(drivers.crash),
    analytics: createAnalytics(drivers.analytics),
    ads: createAds(drivers.ads),
  };
}

type ErrorTarget = Pick<Window, 'addEventListener'>;

/** Lỗi toàn cục luôn được log ra console (như trước), rồi mới chuyển cho crash reporter. */
export function installGlobalErrorHandlers(target: ErrorTarget, crash: CrashReporterPort): void {
  target.addEventListener('error', (event) => {
    const error = (event as ErrorEvent).error || (event as ErrorEvent).message;
    console.error('[UNCAUGHT ERROR]:', error);
    crash.capture(error, { source: 'window.onerror' });
  });
  target.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    console.error('[UNHANDLED REJECTION]:', reason);
    crash.capture(reason, { source: 'unhandledrejection' });
  });
}
