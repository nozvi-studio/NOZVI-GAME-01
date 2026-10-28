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
  track(event: TelemetryEvent): void;
}

/** `rewarded`: xem hết, được thưởng. `dismissed`: đóng sớm. `unavailable`: không có quảng cáo (chưa consent, không mạng, hết fill). */
export type RewardedOutcome = 'rewarded' | 'dismissed' | 'unavailable';

/** Quảng cáo (AdMob...). Gọi không bao giờ ném lỗi, không chặn game; không có SDK thì mọi lệnh là no-op. */
export interface AdsPort {
  /** Hỏi consent (UMP) rồi khởi tạo SDK. Gọi nhiều lần vẫn an toàn. */
  init(): Promise<void>;
  showBanner(): void;
  hideBanner(): void;
  showRewarded(): Promise<RewardedOutcome>;
  /** True once the SDK is ready to serve rewarded ads (consent given, SDK initialised). False on web and without a driver. */
  rewardedReady(): boolean;
  /** Luật EEA/UK: người chơi phải có đường rút lại consent. Cài đặt chỉ hiện nút khi true. */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
}

export interface PlatformServices {
  crash: CrashReporterPort;
  analytics: AnalyticsPort;
  ads: AdsPort;
}
