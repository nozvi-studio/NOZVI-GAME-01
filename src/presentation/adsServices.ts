import type Phaser from 'phaser';
import type { AdsPort } from '../application/platformPort.ts';

/** main.ts stores the ads port in game.registry under this key. */
export const ADS_REGISTRY_KEY = 'ads';

/** Used before main.ts has registered ads (harness, FixtureScene, web) — every call is a no-op. */
export const NO_ADS: AdsPort = {
  init: () => Promise.resolve(),
  showBanner() {},
  hideBanner() {},
  showRewarded: () => Promise.resolve('unavailable'),
  rewardedReady: () => false,
  privacyOptionsRequired: () => false,
  showPrivacyOptions: () => Promise.resolve(),
};

export function adsServices(scene: Phaser.Scene): AdsPort {
  const found = scene.registry?.get(ADS_REGISTRY_KEY) as AdsPort | undefined;
  return found ?? NO_ADS;
}
