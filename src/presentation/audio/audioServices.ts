import type Phaser from 'phaser';
import type { MusicPort } from '../../infrastructure/music.ts';
import type { SfxPort } from '../../infrastructure/sfx.ts';

export type AudioServices = { music: MusicPort; sfx: SfxPort };

/** main.ts stores the services in game.registry under this key. */
export const AUDIO_REGISTRY_KEY = 'audio';

/** Used before main.ts has registered audio (harness, FixtureScene) — every call is a no-op. */
export const SILENT_AUDIO: AudioServices = {
  music: { setTrack() {}, duck() {}, pause() {}, resume() {}, setEnabled() {} },
  sfx: { play() {}, setEnabled() {} },
};

export function audioServices(scene: Phaser.Scene): AudioServices {
  const found = scene.registry?.get(AUDIO_REGISTRY_KEY) as AudioServices | undefined;
  return found ?? SILENT_AUDIO;
}
