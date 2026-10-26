import type { GameAnalyticsLike, ProgressionStatus } from './gameAnalyticsDriver.ts';

/** Hình dạng thực tế của `gameanalytics`, đã đối chiếu với .d.ts và bản ESM ở bước xác nhận API. */
type GameAnalyticsModule = {
  GameAnalytics: {
    configureBuild(build: string): void;
    initialize(gameKey: string, secretKey: string): void;
    isSdkReady(needsInitialized: boolean, warn?: boolean, message?: string): boolean;
    addProgressionEvent(
      status: unknown,
      progression01: string,
      progression02?: string,
      progression03?: string,
      score?: number
    ): void;
    addDesignEvent(eventId: string, value?: number): void;
  };
  EGAProgressionStatus: Record<ProgressionStatus, unknown>;
};

/** Nạp SDK thật bằng `import()` động (chunk riêng) và đổi trạng thái chuỗi sang enum của SDK. */
export async function loadGameAnalytics(): Promise<GameAnalyticsLike> {
  const imported = (await import('gameanalytics')) as unknown as { gameanalytics: GameAnalyticsModule };
  const { GameAnalytics, EGAProgressionStatus } = imported.gameanalytics;
  return {
    configureBuild: (build) => GameAnalytics.configureBuild(build),
    initialize: (gameKey, secretKey) => GameAnalytics.initialize(gameKey, secretKey),
    isReady: () => GameAnalytics.isSdkReady(true, false),
    addProgressionEvent: (status, p1, p2, p3, score) =>
      GameAnalytics.addProgressionEvent(EGAProgressionStatus[status], p1, p2, p3, score),
    addDesignEvent: (eventId, value) => GameAnalytics.addDesignEvent(eventId, value),
  };
}
