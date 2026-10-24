import type { TelemetryEvent } from './telemetry.ts';

export type CrashValue = string | number | boolean;
export type CrashContext = Readonly<Record<string, CrashValue>>;

/** Báo lỗi ra ngoài (Sentry, Crashlytics...). Gọi không bao giờ ném lỗi, không bao giờ chặn game. */
export interface CrashReporterPort {
  capture(error: unknown, context?: CrashContext): void;
  breadcrumb(message: string): void;
  setContext(key: string, value: CrashValue): void;
}

/** Gửi sự kiện theo dõi (CrazyGames, Firebase...). Cùng quy ước: không ném lỗi, không chặn game. */
export interface AnalyticsPort {
  /** Chỉ xếp vào hàng đợi; việc gửi thật diễn ra sau, ngoài khung hình đang chạy. */
  track(event: TelemetryEvent): void;
  /** Gửi ngay những gì còn trong hàng đợi (vd. khi tab sắp đóng). */
  flush(): void;
}

export interface PlatformServices {
  crash: CrashReporterPort;
  analytics: AnalyticsPort;
}
