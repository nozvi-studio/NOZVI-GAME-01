import type {
  AnalyticsPort,
  CrashContext,
  CrashReporterPort,
  CrashValue,
  PlatformServices,
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

export type PlatformDrivers = {
  crash?: CrashDriver | null;
  analytics?: AnalyticsDriver | null;
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

export function createCrashReporter(driver: CrashDriver | null | undefined): CrashReporterPort {
  return {
    capture(error, context) {
      if (driver) safely(() => driver.capture(error, context));
    },
    breadcrumb(message) {
      if (driver?.breadcrumb) safely(() => driver.breadcrumb!(message));
    },
    setContext(key, value) {
      if (driver?.setContext) safely(() => driver.setContext!(key, value));
    },
  };
}

export function createAnalytics(driver: AnalyticsDriver | null | undefined): AnalyticsPort {
  return {
    track(event) {
      if (driver) safely(() => driver.track(event));
    },
  };
}

/** Không truyền driver nào thì mọi lệnh là no-op: game chạy y hệt khi chưa gắn SDK. */
export function createPlatformServices(drivers: PlatformDrivers = {}): PlatformServices {
  return {
    crash: createCrashReporter(drivers.crash),
    analytics: createAnalytics(drivers.analytics),
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
