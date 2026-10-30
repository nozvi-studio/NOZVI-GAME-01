import type { AdMobPlugin } from '@capacitor-community/admob';
import {
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import type { RewardedOutcome } from './platformPort.ts';
import type { AdsDriver } from './platformServices.ts';

export type AdMobConfig = {
  banner: string;
  rewarded: string;
  /** true: yêu cầu quảng cáo thử của Google (không tính tiền, không rủi ro bị khoá tài khoản). */
  testing: boolean;
};

/** ID thử công khai của Google: https://developers.google.com/admob/android/test-ads */
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

type AdsEnv = Readonly<Record<string, unknown>>;

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim() : undefined);

/**
 * Mặc định là quảng cáo thử: chỉ khi `VITE_ADMOB_USE_TEST_ADS=false` và có đủ ID thật mới đổi sang
 * quảng cáo thật. Thiếu ID thật thì trả null (tắt quảng cáo) chứ không lặng lẽ phát quảng cáo thử.
 */
export function resolveAdMobConfig(env: AdsEnv): AdMobConfig | null {
  if (env['VITE_ADMOB_USE_TEST_ADS'] !== 'false') {
    return { banner: TEST_BANNER_ID, rewarded: TEST_REWARDED_ID, testing: true };
  }
  const banner = text(env['VITE_ADMOB_BANNER_ID']);
  const rewarded = text(env['VITE_ADMOB_REWARDED_ID']);
  if (!banner || !rewarded) return null;
  return { banner, rewarded, testing: false };
}

export type AdMobLike = Pick<
  AdMobPlugin,
  | 'initialize'
  | 'requestConsentInfo'
  | 'showConsentForm'
  | 'showPrivacyOptionsForm'
  | 'showBanner'
  | 'hideBanner'
  | 'resumeBanner'
  | 'prepareRewardVideoAd'
  | 'showRewardVideoAd'
  | 'addListener'
>;

type BannerState = 'none' | 'shown' | 'hidden';

/** Quá hạn này mà quảng cáo chưa bắt đầu chiếu (tải chậm hoặc không phản hồi) thì coi như không có quảng cáo. */
export const REWARDED_START_TIMEOUT_MS = 10_000;

export function createAdMobDriver(
  admob: AdMobLike,
  config: AdMobConfig,
  options: { startTimeoutMs?: number } = {}
): AdsDriver {
  const startTimeoutMs = options.startTimeoutMs ?? REWARDED_START_TIMEOUT_MS;
  let ready: Promise<boolean> | null = null;
  let sdkReady = false;
  let privacyRequired = false;
  let wantBanner = false;
  let banner: BannerState = 'none';
  let rewardedBusy = false;

  /** UMP trước, rồi mới khởi tạo SDK; chỉ yêu cầu quảng cáo khi UMP cho phép. */
  const init = (): Promise<boolean> => {
    ready ??= (async () => {
      try {
        let info = await admob.requestConsentInfo();
        if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
          info = await admob.showConsentForm();
        }
        privacyRequired = String(info.privacyOptionsRequirementStatus) === 'REQUIRED';
        if (!info.canRequestAds) return false;
        await admob.initialize({ initializeForTesting: config.testing });
        sdkReady = true;
        return true;
      } catch {
        return false;
      }
    })();
    return ready;
  };

  /** Banner được bật/tắt theo `wantBanner` mới nhất, kể cả khi SDK còn đang khởi tạo. */
  const syncBanner = async (): Promise<void> => {
    if (!(await init())) return;
    if (wantBanner && banner === 'none') {
      banner = 'shown';
      await admob.showBanner({
        adId: config.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        isTesting: config.testing,
      });
    } else if (wantBanner && banner === 'hidden') {
      banner = 'shown';
      await admob.resumeBanner();
    } else if (!wantBanner && banner === 'shown') {
      banner = 'hidden';
      await admob.hideBanner();
    }
  };

  return {
    async init() {
      await init();
    },
    showBanner() {
      wantBanner = true;
      return syncBanner();
    },
    hideBanner() {
      wantBanner = false;
      return syncBanner();
    },
    async showRewarded(): Promise<RewardedOutcome> {
      if (rewardedBusy || !(await init())) return 'unavailable';
      rewardedBusy = true;
      let rewarded = false;
      let settled = false;
      let finish: (outcome: RewardedOutcome) => void = () => {};
      const done = new Promise<RewardedOutcome>((resolve) => {
        finish = (outcome) => {
          settled = true;
          resolve(outcome);
        };
      });
      const handles: { remove(): Promise<void> }[] = [];
      // Đồng hồ chạy từ lúc bắt đầu tải đến lúc quảng cáo thật sự chiếu; xem quảng cáo lâu không bị tính.
      const startTimer = setTimeout(() => finish('unavailable'), startTimeoutMs);
      try {
        handles.push(
          await admob.addListener(RewardAdPluginEvents.Rewarded, () => {
            rewarded = true;
          }),
          // Thưởng đến trước lúc đóng; đợi đóng rồi mới trả kết quả để người chơi về lại game.
          await admob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded ? 'rewarded' : 'dismissed')),
          await admob.addListener(RewardAdPluginEvents.FailedToShow, () => finish('unavailable')),
          await admob.addListener(RewardAdPluginEvents.Showed, () => clearTimeout(startTimer))
        );
        // Không await: tải treo thì để đồng hồ ở trên cắt, và quảng cáo đến muộn sau đó không được bật lên nữa.
        admob
          .prepareRewardVideoAd({ adId: config.rewarded, isTesting: config.testing })
          .then(() => {
            if (settled) return;
            // Plugin chỉ resolve lời gọi này khi có thưởng; đóng sớm thì nó treo, nên không await.
            admob.showRewardVideoAd().catch(() => finish(rewarded ? 'rewarded' : 'unavailable'));
          })
          .catch(() => finish('unavailable'));
        return await done;
      } catch {
        return 'unavailable';
      } finally {
        clearTimeout(startTimer);
        rewardedBusy = false;
        for (const handle of handles) void handle.remove();
      }
    },
    rewardedReady: () => sdkReady,
    privacyOptionsRequired: () => privacyRequired,
    showPrivacyOptions: () => admob.showPrivacyOptionsForm(),
  };
}
