import { describe, expect, test } from 'vitest';
import { MUSIC_ROOT_HZ, SFX_KEYS, SFX_PATCHES } from '../src/content/audio/index.ts';
import type { SfxKey } from '../src/content/audio/index.ts';
import { validatePatch } from '../src/audio-synth/patch.ts';
import { measure } from '../src/audio-synth/normalize.ts';
import { renderPatch } from '../src/audio-synth/render.ts';

const SR = 44100;

/** The sound brief in spec G section 3.2, as a check rather than a promise. */
const LIMIT_MS: Record<SfxKey, { min?: number; max: number }> = {
  bell: { max: 1500 },
  tick: { max: 150 },
  'tap-soft': { max: 300 },
  thud: { max: 400 },
  hollow: { max: 1000 },
  shimmer: { max: 1000 },
  swish: { max: 600 },
  'stinger-win': { min: 3000, max: 5000 },
};

describe('Mirror sfx patches', () => {
  test('one patch per key, no extras', () => {
    expect(Object.keys(SFX_PATCHES).sort()).toEqual([...SFX_KEYS].sort());
    expect(SFX_KEYS).toHaveLength(8);
  });

  test('every patch is valid', () => {
    for (const key of SFX_KEYS) {
      expect(validatePatch(SFX_PATCHES[key], SR), key).toEqual([]);
    }
  });

  test('every patch is inside the brief length limit', () => {
    for (const key of SFX_KEYS) {
      const { durationMs } = SFX_PATCHES[key];
      expect(durationMs, key).toBeLessThanOrEqual(LIMIT_MS[key].max);
      if (LIMIT_MS[key].min !== undefined) {
        expect(durationMs, key).toBeGreaterThanOrEqual(LIMIT_MS[key].min);
      }
    }
  });

  test('every patch renders to audible, in-range, finite audio', () => {
    for (const key of SFX_KEYS) {
      const out = renderPatch(SFX_PATCHES[key], SR);
      const { peak, rms } = measure(out);
      expect(peak, `${key} peak`).toBeGreaterThan(0.1);
      expect(peak, `${key} peak`).toBeLessThanOrEqual(1);
      expect(rms, `${key} rms`).toBeGreaterThan(0.001);
      let firstBad = -1;
      for (let i = 0; i < out.length; i++) {
        if (!Number.isFinite(out[i])) {
          firstBad = i;
          break;
        }
      }
      expect(firstBad, `${key} first non-finite sample index`).toBe(-1);
    }
  });

  test('renders repeat byte for byte', () => {
    for (const key of SFX_KEYS) {
      expect(Array.from(renderPatch(SFX_PATCHES[key], SR))).toEqual(
        Array.from(renderPatch(SFX_PATCHES[key], SR)),
      );
    }
  });

  test('the bell is built on the music root so it sits in key', () => {
    const bell = SFX_PATCHES.bell;
    const layer = bell.layers[0];
    expect(layer.source.kind).toBe('fm');
    if (layer.source.kind !== 'fm') throw new Error('unreachable');
    expect(layer.source.carrierHz / MUSIC_ROOT_HZ).toBeCloseTo(2, 5);
  });

  test('the stinger resolves on its last voice', () => {
    const stinger = SFX_PATCHES['stinger-win'];
    expect(stinger.layers.length).toBeGreaterThanOrEqual(3);
    const starts = stinger.layers.map((l) => l.startMs ?? 0);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    const last = stinger.layers[stinger.layers.length - 1].source;
    if (last.kind !== 'fm') throw new Error('the stinger voices are fm');
    // The final voice is the octave above the root.
    expect(last.carrierHz / MUSIC_ROOT_HZ).toBeCloseTo(4, 2);
  });
});
