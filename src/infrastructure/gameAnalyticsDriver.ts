import type { TelemetryEvent } from '../engine/core/platform/telemetry.ts';
import { isAnalyticsConsentGranted } from './analyticsConsent.ts';
import { initInBackground } from '../engine/core/platform/platformServices.ts';
import type { AnalyticsDriver } from '../engine/core/platform/platformServices.ts';

export type GameAnalyticsConfig = { gameKey: string; secretKey: string; build: string };

export type ProgressionStatus = 'Start' | 'Complete' | 'Fail';

/** Phần của SDK mà game dùng; giữ hẹp để test thay bằng đồ giả. Bản thật bọc ở `gameAnalyticsSdk.ts`. */
export type GameAnalyticsLike = {
  configureBuild(build: string): void;
  initialize(gameKey: string, secretKey: string): void;
  /** Phiên đã mở. SDK bỏ hẳn (không xếp hàng) mọi sự kiện gửi trước thời điểm này. */
  isReady(): boolean;
  addProgressionEvent(
    status: ProgressionStatus,
    progression01: string,
    progression02?: string,
    progression03?: string,
    score?: number
  ): void;
  addDesignEvent(eventId: string, value?: number): void;
};

export type GameAnalyticsOptions = {
  /** Chu kỳ hỏi `isReady` sau khi khởi tạo. */
  readyPollMs?: number;
  /** Quá hạn này mà SDK vẫn chưa sẵn sàng thì bỏ cuộc: mọi sự kiện thành no-op. */
  readyTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type GameAnalyticsDriver = AnalyticsDriver & {
  /** Khởi tạo SDK ngay (nếu đã đồng ý) để phiên đã mở trước khi sự kiện đầu tiên xuất hiện. */
  warmUp(): void;
};

type SdkCall = (ga: GameAnalyticsLike) => void;

/** Mỗi đoạn của eventId tối đa 32 ký tự (giới hạn của GameAnalytics). */
function segment(text: string): string {
  return text.slice(0, 32);
}

function callsFor(event: TelemetryEvent): SdkCall[] {
  switch (event.type) {
    case 'level_start':
      return [(ga) => ga.addProgressionEvent('Start', `chapter${event.chapter}`, event.levelId)];
    case 'level_complete':
      return [
        (ga) => ga.addProgressionEvent('Complete', `chapter${event.chapter}`, event.levelId, undefined, event.stars),
        (ga) => ga.addDesignEvent(`Complete:Moves:${segment(event.levelId)}`, event.moveCount),
        (ga) => ga.addDesignEvent(`Complete:Resets:${segment(event.levelId)}`, event.resetCount),
      ];
    case 'level_abandon':
      return [
        (ga) => ga.addProgressionEvent('Fail', `chapter${event.chapter}`, event.levelId),
        (ga) => ga.addDesignEvent(`Abandon:${segment(event.levelId)}`, event.resetCount),
      ];
    default:
      return [];
  }
}

/**
 * Chưa đồng ý thì không nạp và không khởi tạo SDK (khởi tạo cũng có thể gửi sự kiện phiên). Đồng ý rồi thì
 * SDK nạp bằng `import()` động ở nền (`initInBackground`) và game gọi `warmUp()` ngay để phiên mở sớm.
 * SDK bỏ sự kiện gửi trước khi phiên mở, nên mọi lệnh chờ `isReady()`; tải hỏng, treo hay quá hạn thì
 * mọi lệnh là no-op. Sự kiện khi chưa đồng ý bị bỏ, không giữ lại.
 */
export function createGameAnalyticsDriver(
  config: GameAnalyticsConfig,
  load: () => Promise<GameAnalyticsLike>,
  isConsentGranted: () => boolean = isAnalyticsConsentGranted,
  options: GameAnalyticsOptions = {}
): GameAnalyticsDriver {
  const {
    readyPollMs = 200,
    readyTimeoutMs = 10_000,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;

  const waitUntilReady = async (ga: GameAnalyticsLike): Promise<boolean> => {
    for (let waited = 0; waited <= readyTimeoutMs; waited += readyPollMs) {
      if (ga.isReady()) return true;
      await sleep(readyPollMs);
    }
    return false;
  };

  let ready: Promise<GameAnalyticsLike | null> | null = null;
  const sdk = (): Promise<GameAnalyticsLike | null> =>
    (ready ??= initInBackground(
      'gameanalytics',
      async () => {
        const ga = await load();
        ga.configureBuild(config.build);
        ga.initialize(config.gameKey, config.secretKey);
        return (await waitUntilReady(ga)) ? ga : null;
      },
      readyTimeoutMs + 5000
    ));

  return {
    warmUp() {
      if (isConsentGranted()) void sdk();
    },
    track(event) {
      if (!isConsentGranted()) return;
      const calls = callsFor(event);
      if (calls.length === 0) return;
      return sdk().then((ga) => {
        if (!ga) return;
        for (const call of calls) {
          try {
            call(ga);
          } catch {
            // Một lệnh hỏng không chặn các lệnh sau.
          }
        }
      });
    },
  };
}
