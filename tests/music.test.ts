import { describe, expect, test } from 'vitest';
import { createMusic } from '../src/infrastructure/music.ts';
import type { MediaLike, MusicEnv, MusicOptions } from '../src/infrastructure/music.ts';

class FakeMedia implements MediaLike {
  src = '';
  loop = false;
  preload = '';
  volume = 1;
  paused = true;
  plays = 0;
  reject: Error | null = null;
  private onError: (() => void) | null = null;
  play(): Promise<void> {
    this.plays++;
    if (this.reject) return Promise.reject(this.reject);
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  addEventListener(_type: 'error', listener: () => void): void {
    this.onError = listener;
  }
  fail(): void {
    this.onError?.();
  }
}

function setup(ogg = true) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, () => void>();
  const media: FakeMedia[] = [];
  const gestures: Array<() => void> = [];
  const warnings: string[] = [];
  let visibility: ((hidden: boolean) => void) | null = null;
  const env: MusicEnv = {
    createElement: () => {
      const m = new FakeMedia();
      media.push(m);
      return m;
    },
    canPlayOgg: () => ogg,
    setInterval: (cb) => {
      const id = nextId++;
      timers.set(id, cb);
      return id;
    },
    clearInterval: (id) => {
      timers.delete(id);
    },
    now: () => now,
    onFirstGesture: (cb) => {
      gestures.push(cb);
    },
    onVisibilityChange: (cb) => {
      visibility = cb;
    },
    warn: (msg) => {
      warnings.push(msg);
    },
  };
  const opts: MusicOptions = {
    volume: 0.5,
    toggleOutMs: 300,
    toggleInMs: 1000,
    duckDownMs: 200,
    duckUpMs: 800,
    files: (id) => [`audio/${id}.ogg`, `audio/${id}.m4a`],
  };
  const music = createMusic(env, opts);
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 50) {
      now += 50;
      [...timers.values()].forEach((cb) => cb());
    }
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { music, media, advance, flush, gestures, warnings, hide: (h: boolean) => visibility?.(h) };
}

describe('MusicPort', () => {
  test('starts a looping track and fades it in', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 1000);
    const [a] = media;
    expect(a.src).toBe('audio/music-sky.ogg');
    expect(a.loop).toBe(true);
    expect(a.plays).toBe(1);
    expect(a.volume).toBe(0);
    advance(500);
    expect(a.volume).toBeCloseTo(0.25, 5);
    advance(500);
    expect(a.volume).toBeCloseTo(0.5, 5);
  });

  test('falls back to m4a without Ogg support', () => {
    const { music, media } = setup(false);
    music.setTrack('music-sky', 0);
    expect(media[0].src).toBe('audio/music-sky.m4a');
  });

  test('asking for the playing track does nothing', () => {
    const { music, media } = setup();
    music.setTrack('music-sky', 0);
    music.setTrack('music-sky', 1000);
    expect(media[0].plays).toBe(1);
    expect(media[1].plays).toBe(0);
  });

  test('crossfades between two elements and unloads the old one', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    advance(100);
    music.setTrack('music-stele', 1500);
    const [a, b] = media;
    expect(b.src).toBe('audio/music-stele.ogg');
    advance(750);
    expect(a.volume).toBeCloseTo(0.25, 5);
    expect(b.volume).toBeCloseTo(0.25, 5);
    advance(750);
    expect(a.paused).toBe(true);
    expect(a.src).toBe('');
    expect(b.volume).toBeCloseTo(0.5, 5);
  });

  test('a gap fades the old track out, goes quiet, then fades the new one in', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    advance(100);
    music.setTrack('music-stele', 600, 500);
    const [a] = media;
    advance(300);
    expect(a.volume).toBeCloseTo(0.25, 5);
    advance(300);
    expect(a.paused).toBe(true);
    expect(a.src).toBe('');
    advance(400);
    expect(a.plays).toBe(1);
    advance(100);
    expect(a.src).toBe('audio/music-stele.ogg');
    expect(a.plays).toBe(2);
    advance(600);
    expect(a.volume).toBeCloseTo(0.5, 5);
  });

  test('a gap with nothing playing starts the track straight away', () => {
    const { music, media } = setup();
    music.setTrack('music-sky', 1000, 500);
    expect(media[0].plays).toBe(1);
  });

  test('changing the wanted track during the gap retargets the pending start', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.setTrack('music-stele', 400, 400);
    advance(500);
    music.setTrack('music-sky', 400, 400);
    advance(400);
    const playing = media.filter((m) => m.plays > 0 && !m.paused);
    expect(playing).toHaveLength(1);
    expect(playing[0].src).toBe('audio/music-sky.ogg');
    expect(media.some((m) => m.src === 'audio/music-stele.ogg')).toBe(false);
  });

  test('switching back mid-fade reuses the fading element', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.setTrack('music-stele', 1000);
    advance(500);
    music.setTrack('music-sky', 1000);
    expect(media[0].src).toBe('audio/music-sky.ogg');
    advance(1000);
    expect(media[0].volume).toBeCloseTo(0.5, 5);
    expect(media[1].src).toBe('');
  });

  test('duck lowers, holds, then restores', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.duck(0.3, 1500);
    advance(200);
    expect(media[0].volume).toBeCloseTo(0.15, 5);
    advance(1500);
    expect(media[0].volume).toBeCloseTo(0.15, 5);
    advance(800);
    expect(media[0].volume).toBeCloseTo(0.5, 5);
  });

  test('a new track cancels the duck', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.duck(0.3, 1500);
    advance(100);
    music.setTrack('music-stele', 1000);
    advance(1000);
    expect(media[1].volume).toBeCloseTo(0.5, 5);
  });

  test('disable fades out and pauses but keeps the track; enable resumes it', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.setEnabled(false);
    advance(300);
    expect(media[0].paused).toBe(true);
    expect(media[0].src).toBe('audio/music-sky.ogg');
    music.setEnabled(true);
    expect(media[0].plays).toBe(2);
    advance(1000);
    expect(media[0].volume).toBeCloseTo(0.5, 5);
  });

  test('while disabled a new track is remembered, not played', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.setEnabled(false);
    advance(300);
    music.setTrack('music-stele', 1500);
    expect(media[1].plays).toBe(0);
    music.setEnabled(true);
    expect(media[1].src).toBe('audio/music-stele.ogg');
    expect(media[1].plays).toBe(1);
    advance(1000);
    expect(media[1].volume).toBeCloseTo(0.5, 5);
    expect(media[0].src).toBe('');
  });

  test('pause stops at once; resume plays again only when enabled', () => {
    const { music, media, advance } = setup();
    music.setTrack('music-sky', 0);
    music.pause();
    expect(media[0].paused).toBe(true);
    music.resume();
    expect(media[0].plays).toBe(2);
    music.setEnabled(false);
    advance(300);
    music.pause();
    music.resume();
    expect(media[0].plays).toBe(2);
  });

  test('a track set while paused waits for resume', () => {
    const { music, media } = setup();
    music.pause();
    music.setTrack('music-sky', 0);
    expect(media[0].plays).toBe(0);
    music.resume();
    expect(media[0].plays).toBe(1);
  });

  test('hidden page pauses, visible page resumes', () => {
    const { music, media, hide } = setup();
    music.setTrack('music-sky', 0);
    hide(true);
    expect(media[0].paused).toBe(true);
    hide(false);
    expect(media[0].plays).toBe(2);
  });

  test('autoplay block waits for the first gesture, then fades in', async () => {
    const { music, media, gestures, flush, advance } = setup();
    media[0].reject = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    music.setTrack('music-sky', 0);
    await flush();
    expect(gestures).toHaveLength(1);
    media[0].reject = null;
    gestures[0]();
    expect(media[0].plays).toBe(2);
    expect(media[0].volume).toBe(0);
    advance(1000);
    expect(media[0].volume).toBeCloseTo(0.5, 5);
  });

  test('load errors and other play failures warn once per track', async () => {
    const { music, media, warnings, flush } = setup();
    media[0].reject = new Error('decode');
    music.setTrack('music-sky', 0);
    await flush();
    media[0].fail();
    media[0].fail();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('music-sky');
  });
});
