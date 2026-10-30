import { describe, expect, test, vi } from 'vitest';
import { createAdMobDriver, resolveAdMobConfig } from '../../../src/engine/core/platform/admobDriver.ts';
import type { AdMobConfig, AdMobLike } from '../../../src/engine/core/platform/admobDriver.ts';
import { createAds } from '../../../src/engine/core/platform/platformServices.ts';

const CONFIG: AdMobConfig = { banner: 'banner-id', rewarded: 'rewarded-id', testing: true };

type Listener = () => void;

/** Plugin giả: ghi lại lời gọi, cho phép bắn sự kiện thưởng/đóng như plugin thật. */
function fakePlugin(overrides: Partial<Record<string, unknown>> = {}) {
  const listeners = new Map<string, Listener>();
  const calls: string[] = [];
  const plugin = {
    initialize: vi.fn(async () => void calls.push('initialize')),
    requestConsentInfo: vi.fn(async () => ({
      status: 'NOT_REQUIRED',
      isConsentFormAvailable: false,
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    })),
    showConsentForm: vi.fn(async () => ({
      status: 'OBTAINED',
      canRequestAds: true,
      privacyOptionsRequirementStatus: 'REQUIRED',
    })),
    showPrivacyOptionsForm: vi.fn(async () => {}),
    showBanner: vi.fn(async () => void calls.push('showBanner')),
    hideBanner: vi.fn(async () => void calls.push('hideBanner')),
    resumeBanner: vi.fn(async () => void calls.push('resumeBanner')),
    prepareRewardVideoAd: vi.fn(async () => ({ adUnitId: 'x' })),
    showRewardVideoAd: vi.fn(() => new Promise(() => {})),
    addListener: vi.fn(async (name: string, fn: Listener) => {
      listeners.set(name, fn);
      return { remove: async () => void listeners.delete(name) };
    }),
    ...overrides,
  };
  return { plugin: plugin as unknown as AdMobLike, raw: plugin, calls, listeners };
}

describe('resolveAdMobConfig', () => {
  test('mặc định dùng quảng cáo thử của Google', () => {
    const config = resolveAdMobConfig({});
    expect(config).toMatchObject({ testing: true });
    expect(config?.banner).toContain('ca-app-pub-3940256099942544');
    expect(config?.rewarded).toContain('ca-app-pub-3940256099942544');
  });

  test('USE_TEST_ADS=false và đủ ID thì dùng ID thật', () => {
    expect(
      resolveAdMobConfig({ VITE_ADMOB_USE_TEST_ADS: 'false', VITE_ADMOB_BANNER_ID: ' b ', VITE_ADMOB_REWARDED_ID: 'r' })
    ).toEqual({ banner: 'b', rewarded: 'r', testing: false });
  });

  test('USE_TEST_ADS=false mà thiếu ID thì tắt quảng cáo, không rơi về quảng cáo thử', () => {
    expect(resolveAdMobConfig({ VITE_ADMOB_USE_TEST_ADS: 'false', VITE_ADMOB_BANNER_ID: 'b' })).toBeNull();
  });
});

describe('AdMob driver: consent và khởi tạo', () => {
  test('canRequestAds=false thì không khởi tạo SDK, không hiện banner, rewarded là unavailable', async () => {
    const { plugin, raw } = fakePlugin({
      requestConsentInfo: vi.fn(async () => ({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'UNKNOWN' })),
    });
    const driver = createAdMobDriver(plugin, CONFIG);
    await driver.showBanner();
    expect(raw.initialize).not.toHaveBeenCalled();
    expect(raw.showBanner).not.toHaveBeenCalled();
    expect(await driver.showRewarded()).toBe('unavailable');
  });

  test('REQUIRED và có form thì hiện form consent rồi mới khởi tạo', async () => {
    const { plugin, raw, calls } = fakePlugin({
      requestConsentInfo: vi.fn(async () => ({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' })),
    });
    const driver = createAdMobDriver(plugin, CONFIG);
    await driver.init();
    expect(raw.showConsentForm).toHaveBeenCalledOnce();
    expect(calls).toContain('initialize');
    expect(driver.privacyOptionsRequired()).toBe(true);
  });

  test('rewardedReady chỉ đúng sau khi SDK khởi tạo xong, sai khi consent không cho phép', async () => {
    const ok = createAdMobDriver(fakePlugin().plugin, CONFIG);
    expect(ok.rewardedReady()).toBe(false);
    await ok.init();
    expect(ok.rewardedReady()).toBe(true);
    const denied = createAdMobDriver(
      fakePlugin({ requestConsentInfo: vi.fn(async () => ({ status: 'REQUIRED', canRequestAds: false, privacyOptionsRequirementStatus: 'UNKNOWN' })) }).plugin,
      CONFIG
    );
    await denied.init();
    expect(denied.rewardedReady()).toBe(false);
  });

  test('init gọi nhiều lần chỉ chạy UMP và SDK một lần', async () => {
    const { plugin, raw } = fakePlugin();
    const driver = createAdMobDriver(plugin, CONFIG);
    await Promise.all([driver.init(), driver.init()]);
    expect(raw.requestConsentInfo).toHaveBeenCalledOnce();
    expect(raw.initialize).toHaveBeenCalledOnce();
  });

  test('UMP ném lỗi thì coi như không được phép yêu cầu quảng cáo', async () => {
    const { plugin, raw } = fakePlugin({ requestConsentInfo: vi.fn(async () => { throw new Error('network'); }) });
    const driver = createAdMobDriver(plugin, CONFIG);
    await expect(driver.init()).resolves.toBeUndefined();
    expect(raw.initialize).not.toHaveBeenCalled();
  });
});

describe('AdMob driver: banner', () => {
  test('show rồi hide rồi show: tạo một lần, sau đó ẩn/hiện lại', async () => {
    const { plugin, calls } = fakePlugin();
    const driver = createAdMobDriver(plugin, CONFIG);
    await driver.showBanner();
    await driver.hideBanner();
    await driver.showBanner();
    expect(calls.filter((c) => c.endsWith('Banner'))).toEqual(['showBanner', 'hideBanner', 'resumeBanner']);
  });

  test('hide gọi trước khi SDK khởi tạo xong thì banner không hiện', async () => {
    const { plugin, raw } = fakePlugin();
    const driver = createAdMobDriver(plugin, CONFIG);
    const shown = driver.showBanner();
    const hidden = driver.hideBanner();
    await Promise.all([shown, hidden]);
    expect(raw.showBanner).not.toHaveBeenCalled();
  });
});

describe('AdMob driver: rewarded', () => {
  async function run(events: string[]) {
    const { plugin, listeners } = fakePlugin();
    const driver = createAdMobDriver(plugin, CONFIG);
    const outcome = driver.showRewarded();
    await vi.waitFor(() => expect(listeners.size).toBe(4));
    await vi.waitFor(() => expect((plugin.showRewardVideoAd as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1));
    for (const name of events) listeners.get(name)?.();
    return { outcome: await outcome, listeners };
  }

  test('nhận thưởng rồi đóng: rewarded', async () => {
    const { outcome } = await run(['onRewardedVideoAdReward', 'onRewardedVideoAdDismissed']);
    expect(outcome).toBe('rewarded');
  });

  test('đóng sớm không thưởng: dismissed, không treo dù plugin không resolve', async () => {
    const { outcome } = await run(['onRewardedVideoAdDismissed']);
    expect(outcome).toBe('dismissed');
  });

  test('không hiện được: unavailable', async () => {
    const { outcome } = await run(['onRewardedVideoAdFailedToShow']);
    expect(outcome).toBe('unavailable');
  });

  test('gỡ listener sau khi xong, không dồn lại sang lần sau', async () => {
    const { listeners } = await run(['onRewardedVideoAdDismissed']);
    await vi.waitFor(() => expect(listeners.size).toBe(0));
  });

  test('tải quảng cáo treo quá hạn: unavailable, không bật quảng cáo đến muộn', async () => {
    vi.useFakeTimers();
    try {
      let load: () => void = () => {};
      const { plugin, raw } = fakePlugin({
        prepareRewardVideoAd: vi.fn(() => new Promise<void>((resolve) => { load = resolve; })),
      });
      const driver = createAdMobDriver(plugin, CONFIG, { startTimeoutMs: 5000 });
      const outcome = driver.showRewarded();
      await vi.advanceTimersByTimeAsync(5000);
      expect(await outcome).toBe('unavailable');
      load();
      await vi.advanceTimersByTimeAsync(0);
      expect(raw.showRewardVideoAd).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test('quảng cáo đã chiếu thì không bị cắt theo đồng hồ chờ', async () => {
    vi.useFakeTimers();
    try {
      const { plugin, listeners } = fakePlugin();
      const driver = createAdMobDriver(plugin, CONFIG, { startTimeoutMs: 5000 });
      const outcome = driver.showRewarded();
      await vi.advanceTimersByTimeAsync(0);
      listeners.get('onRewardedVideoAdShowed')?.();
      await vi.advanceTimersByTimeAsync(60_000);
      listeners.get('onRewardedVideoAdReward')?.();
      listeners.get('onRewardedVideoAdDismissed')?.();
      expect(await outcome).toBe('rewarded');
    } finally {
      vi.useRealTimers();
    }
  });

  test('tải quảng cáo thất bại: unavailable', async () => {
    const { plugin } = fakePlugin({ prepareRewardVideoAd: vi.fn(async () => { throw new Error('no fill'); }) });
    expect(await createAdMobDriver(plugin, CONFIG).showRewarded()).toBe('unavailable');
  });
});

describe('AdsPort', () => {
  test('không có driver: mọi lệnh là no-op', async () => {
    const ads = createAds(null);
    await ads.init();
    ads.showBanner();
    ads.hideBanner();
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(ads.rewardedReady()).toBe(false);
    expect(ads.privacyOptionsRequired()).toBe(false);
    await ads.showPrivacyOptions();
  });

  test('driver ném lỗi hoặc reject không làm hỏng game', async () => {
    const boom = () => { throw new Error('sdk'); };
    const reject = () => Promise.reject(new Error('sdk'));
    const ads = createAds({ init: reject, showBanner: boom, hideBanner: reject, showRewarded: reject, rewardedReady: boom, privacyOptionsRequired: boom, showPrivacyOptions: reject });
    await expect(ads.init()).resolves.toBeUndefined();
    expect(() => { ads.showBanner(); ads.hideBanner(); }).not.toThrow();
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(ads.privacyOptionsRequired()).toBe(false);
    await expect(ads.showPrivacyOptions()).resolves.toBeUndefined();
  });
});
