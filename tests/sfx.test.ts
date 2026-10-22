import { describe, expect, test } from 'vitest';
import { SFX_KEYS } from '../src/content/audio/index.ts';
import type { SfxKey } from '../src/content/audio/index.ts';
import { createSfx } from '../src/infrastructure/sfx.ts';
import type { AudioCue, SfxDriver, SfxEnv } from '../src/infrastructure/sfx.ts';

function setup(lengthMs = 500) {
  const calls: Array<{ key: SfxKey; rate: number; volume: number }> = [];
  const loaded = new Set<SfxKey>(SFX_KEYS);
  const state = { locked: false, throwOn: null as SfxKey | null };
  const driver: SfxDriver = {
    isLocked: () => state.locked,
    has: (key) => loaded.has(key),
    play: (key, config) => {
      if (key === state.throwOn) throw new Error('boom');
      calls.push({ key, ...config });
      return lengthMs;
    },
  };
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; cb: () => void }>();
  const warnings: string[] = [];
  const env: SfxEnv = {
    now: () => now,
    setTimeout: (cb, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, cb });
      return id;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
    warn: (msg) => {
      warnings.push(msg);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (t.at <= now) {
        timers.delete(id);
        t.cb();
      }
    }
  };
  const sfx = createSfx(driver, env, { volume: 0.8, maxVoices: 6, repeatGapMs: 40 });
  return { sfx, calls, loaded, state, warnings, advance };
}

const cue = (key: SfxKey, extra: Partial<AudioCue> = {}): AudioCue => ({ key, rate: 1, volume: 1, delayMs: 0, ...extra });

describe('SfxPort', () => {
  test('plays with the cue rate and volume times the bus volume', () => {
    const { sfx, calls } = setup();
    sfx.play([cue('bell', { rate: 1.5, volume: 0.5 })]);
    expect(calls).toEqual([{ key: 'bell', rate: 1.5, volume: 0.4 }]);
  });

  test('disabled plays nothing until enabled again', () => {
    const { sfx, calls } = setup();
    sfx.setEnabled(false);
    sfx.play([cue('tick')]);
    expect(calls).toHaveLength(0);
    sfx.setEnabled(true);
    sfx.play([cue('tick')]);
    expect(calls).toHaveLength(1);
  });

  test('no driver is silent and safe', () => {
    const sfx = createSfx(null, { now: () => 0, setTimeout: () => 0, clearTimeout: () => {}, warn: () => {} }, {
      volume: 1,
      maxVoices: 6,
      repeatGapMs: 40,
    });
    expect(() => sfx.play([cue('tick')])).not.toThrow();
  });

  test('locked audio skips quietly', () => {
    const { sfx, calls, state, warnings } = setup();
    state.locked = true;
    sfx.play([cue('tick')]);
    expect(calls).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  test('missing or failing sounds warn once per key and never throw', () => {
    const { sfx, loaded, state, warnings, advance } = setup();
    loaded.delete('hollow');
    state.throwOn = 'thud';
    sfx.play([cue('hollow'), cue('thud')]);
    advance(100);
    sfx.play([cue('hollow'), cue('thud')]);
    expect(warnings).toHaveLength(2);
  });

  test('the same key within the repeat gap is dropped', () => {
    const { sfx, calls, advance } = setup();
    sfx.play([cue('bell')]);
    advance(39);
    sfx.play([cue('bell')]);
    expect(calls).toHaveLength(1);
    advance(1);
    sfx.play([cue('bell')]);
    expect(calls).toHaveLength(2);
  });

  test('at most six voices at once; ended voices free their slot', () => {
    const { sfx, calls, advance } = setup(500);
    sfx.play(['bell', 'tick', 'tap-soft', 'thud', 'hollow', 'shimmer', 'swish'].map((k) => cue(k as SfxKey)));
    expect(calls).toHaveLength(6);
    advance(500);
    sfx.play([cue('swish')]);
    expect(calls).toHaveLength(7);
  });

  test('delayed cues fire later and are cancelled by disabling', () => {
    const { sfx, calls, advance } = setup();
    sfx.play([cue('hollow', { delayMs: 60 })]);
    advance(59);
    expect(calls).toHaveLength(0);
    advance(1);
    expect(calls).toHaveLength(1);
    sfx.play([cue('shimmer', { delayMs: 60 })]);
    sfx.setEnabled(false);
    sfx.setEnabled(true);
    advance(100);
    expect(calls).toHaveLength(1);
  });
});
