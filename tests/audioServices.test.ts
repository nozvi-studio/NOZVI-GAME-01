import { describe, expect, test } from 'vitest';
import type Phaser from 'phaser';
import { AUDIO_REGISTRY_KEY, SILENT_AUDIO, audioServices } from '../src/presentation/audio/audioServices.ts';
import type { AudioServices } from '../src/presentation/audio/audioServices.ts';
import { trackFor } from '../src/presentation/audio/tracks.ts';

const sceneWith = (value: unknown) =>
  ({ registry: { get: (key: string) => (key === AUDIO_REGISTRY_KEY ? value : undefined) } }) as unknown as Phaser.Scene;

describe('audio services', () => {
  test('reads the services from the game registry', () => {
    const services = { music: SILENT_AUDIO.music, sfx: SILENT_AUDIO.sfx } satisfies AudioServices;
    expect(audioServices(sceneWith(services))).toBe(services);
  });

  test('falls back to silent services that accept every call', () => {
    const audio = audioServices(sceneWith(undefined));
    expect(audio).toBe(SILENT_AUDIO);
    expect(() => {
      audio.music.setTrack('music-sky', 100);
      audio.music.duck(0.3, 100);
      audio.music.pause();
      audio.music.resume();
      audio.music.setEnabled(false);
      audio.sfx.play([{ key: 'tick', rate: 1, volume: 1, delayMs: 0 }]);
      audio.sfx.setEnabled(false);
    }).not.toThrow();
  });
});

describe('trackFor', () => {
  test('menu and map share the sky track; play has its own', () => {
    expect(trackFor('MenuScene')).toBe('music-sky');
    expect(trackFor('LevelSelectScene')).toBe('music-sky');
    expect(trackFor('PlayScene')).toBe('music-stele');
  });
});
