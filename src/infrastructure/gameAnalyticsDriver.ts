import type { TelemetryEvent } from '../engine/core/platform/telemetry.ts';
import { initInBackground } from '../engine/core/platform/platformServices.ts';
import type { AnalyticsDriver } from '../engine/core/platform/platformServices.ts';
import { getSafeStorage } from '../engine/core/platform/safeStorage.ts';
import type { PrivacyChoices } from '../application/privacyChoices.ts';
import { clearGameAnalyticsStore } from './gameAnalyticsStore.ts';

export type GameAnalyticsConfig = { gameKey: string; secretKey: string; build: string };

export type ProgressionStatus = 'Start' | 'Complete' | 'Fail';

/** Phần của SDK mà game dùng; giữ hẹp để test thay bằng đồ giả. Bản thật bọc ở `gameAnalyticsSdk.ts`. */
export type GameAnalyticsLike = {
  configureBuild(build: string): void;
  /** Chỉ có tác dụng trước `initialize`. */
  configureUserId(userId: string): void;
  initialize(gameKey: string, secretKey: string): void;
  /** Phiên đã mở. SDK bỏ hẳn (không xếp hàng) mọi sự kiện gửi trước thời điểm này. */
  isReady(): boolean;
  setEnabledEventSubmission(flag: boolean): void;
  addProgressionEvent(
    status: ProgressionStatus,
    progression01: string,
    progression02?: string,
    progression03?: string,
    score?: number
  ): void;
  addDesignEvent(eventId: string, value?: number): void;
};

export type AnalyticsPrivacy = Pick<PrivacyChoices, 'get' | 'userId' | 'onChange'>;

export type GameAnalyticsOptions = {
  /** Chu kỳ hỏi `isReady` sau khi khởi tạo. */
  readyPollMs?: number;
  /** Quá hạn này mà SDK vẫn chưa sẵn sàng thì bỏ cuộc: mọi sự kiện thành no-op. */
  readyTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Nơi SDK lưu sự kiện chưa gửi; mặc định localStorage. */
  store?: Pick<Storage, 'removeItem'> | null;
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
 * Theo `PrivacyChoices`: chưa đồng ý thì không nạp, không khởi tạo SDK. Đồng ý thì nạp ở nền và gắn userId của
 * game trước `initialize`. Rút lại thì ngừng gửi và xóa kho sự kiện chưa gửi. SDK không đổi được userId khi đang
 * chạy, nên bật lại trong cùng phiên chỉ có hiệu lực từ lần mở app sau.
 */
export function createGameAnalyticsDriver(
  config: GameAnalyticsConfig,
  load: () => Promise<GameAnalyticsLike>,
  privacy: AnalyticsPrivacy,
  options: GameAnalyticsOptions = {}
): GameAnalyticsDriver {
  const {
    readyPollMs = 200,
    readyTimeoutMs = 10_000,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    store = getSafeStorage(),
  } = options;

  const waitUntilReady = async (ga: GameAnalyticsLike): Promise<boolean> => {
    for (let waited = 0; waited <= readyTimeoutMs; waited += readyPollMs) {
      if (ga.isReady()) return true;
      await sleep(readyPollMs);
    }
    return false;
  };

  let ready: Promise<GameAnalyticsLike | null> | null = null;
  /** Đã rút lại sau khi SDK chạy: dừng hẳn tới lần mở sau. */
  let stopped = false;
  /** SDK ngay khi đã `initialize`, kể cả khi chờ sẵn sàng quá hạn (ready = null): rút lại vẫn tắt gửi trên bản này. */
  let started: GameAnalyticsLike | null = null;

  const sdk = (): Promise<GameAnalyticsLike | null> =>
    (ready ??= initInBackground(
      'gameanalytics',
      async () => {
        const ga = await load();
        // Rút lại trong lúc đang nạp SDK: không mở phiên, không dùng userId mới.
        if (!active()) return null;
        ga.configureBuild(config.build);
        ga.configureUserId(privacy.userId());
        if (!active()) return null;
        ga.initialize(config.gameKey, config.secretKey);
        started = ga;
        const isReady = await waitUntilReady(ga);
        if (!active()) {
          disable(ga);
          return null;
        }
        return isReady ? ga : null;
      },
      readyTimeoutMs + 5000
    ));

  const disable = (ga: GameAnalyticsLike | null): void => {
    try {
      ga?.setEnabledEventSubmission(false);
    } catch {
      // SDK hỏng: đằng nào cũng không gửi nữa.
    }
  };

  const active = (): boolean => privacy.get().analytics && !stopped;

  if (!privacy.get().analytics) clearGameAnalyticsStore(store, config.gameKey);

  privacy.onChange((state) => {
    if (!state.analytics) {
      if (ready) {
        stopped = true;
        disable(started);
      }
      clearGameAnalyticsStore(store, config.gameKey);
      return;
    }
    if (!ready && !stopped) void sdk();
  });

  return {
    warmUp() {
      if (active()) void sdk();
    },
    track(event) {
      if (!active()) return;
      const calls = callsFor(event);
      if (calls.length === 0) return;
      return sdk().then((ga) => {
        if (!ga || !active()) return;
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
