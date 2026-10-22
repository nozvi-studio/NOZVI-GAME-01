import { describe, expect, test } from 'vitest';
import { applyNormalize, measure } from '../src/audio-synth/normalize.ts';
import type { Patch } from '../src/audio-synth/patch.ts';
import { FADE_OUT_MS, renderPatch } from '../src/audio-synth/render.ts';

const SR = 44100;

const simple = (over: Partial<Patch> = {}): Patch => ({
  durationMs: 200,
  seed: 11,
  layers: [{ source: { kind: 'sine', hz: 440 }, env: { attackMs: 1, decayMs: 199 } }],
  normalize: { peak: 0.8 },
  ...over,
});

const SUSTAIN = { attackMs: 0, decayMs: 0, sustain: 1 };

/** Amplitude of the sinusoidal component at `hz` (single-bin DFT projection). */
function amplitudeAt(samples: Float32Array, hz: number, sampleRate: number): number {
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples.length; i++) {
    const phase = (2 * Math.PI * hz * i) / sampleRate;
    re += samples[i] * Math.cos(phase);
    im += samples[i] * Math.sin(phase);
  }
  return (2 / samples.length) * Math.hypot(re, im);
}

const peakIn = (out: Float32Array, fromMs: number, toMs: number): number =>
  measure(out.subarray(Math.round((fromMs * SR) / 1000), Math.round((toMs * SR) / 1000))).peak;

describe('measure and applyNormalize', () => {
  test('measure reports peak and rms', () => {
    const m = measure(Float32Array.from([0, 0.5, -1, 0.5]));
    expect(m.peak).toBe(1);
    expect(m.rms).toBeCloseTo(Math.sqrt((0 + 0.25 + 1 + 0.25) / 4), 6);
  });

  test('a peak target scales the loudest sample onto it', () => {
    const out = applyNormalize(Float32Array.from([0.1, -0.2, 0.05]), { peak: 0.9 });
    expect(measure(out).peak).toBeCloseTo(0.9, 6);
  });

  test('an rms target scales to that rms', () => {
    const out = applyNormalize(Float32Array.from([0.1, -0.1, 0.1, -0.1]), { rms: 0.4 });
    expect(measure(out).rms).toBeCloseTo(0.4, 6);
  });

  test('an rms target never pushes the peak past 0.99', () => {
    const out = applyNormalize(Float32Array.from([0.001, 0.5, -0.001]), { rms: 0.9 });
    expect(measure(out).peak).toBeLessThanOrEqual(0.99 + 1e-6);
  });

  test('an rms target hard-limits the peak instead of rescaling the rest', () => {
    const input = Float32Array.from([0.001, 0.5, -0.001]);
    const scale = 0.9 / measure(input).rms;
    const out = applyNormalize(input, { rms: 0.9 });
    // The spike is clamped; the quiet samples still got the full rms scale.
    expect(out[1]).toBeCloseTo(0.99, 6);
    expect(out[0]).toBeCloseTo(0.001 * scale, 6);
    expect(out[2]).toBeCloseTo(-0.001 * scale, 6);
  });

  test('an rms target clamps negative excursions to -0.99', () => {
    const out = applyNormalize(Float32Array.from([0.001, -0.5, 0.001]), { rms: 0.9 });
    expect(out[1]).toBeCloseTo(-0.99, 6);
  });

  test('silence is left alone instead of dividing by zero', () => {
    const out = applyNormalize(new Float32Array(16), { peak: 0.8 });
    expect(Array.from(out)).toEqual(Array.from(new Float32Array(16)));
  });

  test('silence is left alone for an rms target too', () => {
    const out = applyNormalize(new Float32Array(16), { rms: 0.3 });
    expect(Array.from(out)).toEqual(Array.from(new Float32Array(16)));
  });
});

describe('applyNormalize copies', () => {
  test('silence returns a new array, not the input itself', () => {
    for (const target of [{ peak: 0.8 }, { rms: 0.3 }]) {
      const input = new Float32Array(16);
      const out = applyNormalize(input, target);
      expect(out).not.toBe(input);
      expect(out.length).toBe(input.length);
    }
  });
});

describe('renderPatch', () => {
  test('produces exactly the requested number of samples', () => {
    expect(renderPatch(simple(), SR).length).toBe(Math.round((200 * SR) / 1000));
    expect(renderPatch(simple({ durationMs: 1000 }), 8000).length).toBe(8000);
  });

  test('is deterministic for a noise patch', () => {
    const noisy = simple({
      layers: [{ source: { kind: 'noise', color: 'white' }, env: { attackMs: 1, decayMs: 199 } }],
    });
    expect(Array.from(renderPatch(noisy, SR))).toEqual(Array.from(renderPatch(noisy, SR)));
  });

  test('a different seed gives different samples', () => {
    const a = simple({
      seed: 1,
      layers: [{ source: { kind: 'noise', color: 'white' }, env: { attackMs: 1, decayMs: 199 } }],
    });
    const b = { ...a, seed: 2 };
    expect(Array.from(renderPatch(a, SR))).not.toEqual(Array.from(renderPatch(b, SR)));
  });

  test('two identical-config noise layers draw from separate PRNG streams', () => {
    const layer = { source: { kind: 'noise' as const, color: 'white' as const }, env: SUSTAIN };
    const one = renderPatch(simple({ normalize: { peak: 1 }, layers: [layer] }), SR);
    const two = renderPatch(simple({ normalize: { peak: 1 }, layers: [layer, layer] }), SR);
    // With one shared stream both layers would be the same signal, so the normalized mix
    // would equal the single-layer render. Separate streams make the mix a different signal.
    let maxDiff = 0;
    for (let i = 0; i < one.length; i++) maxDiff = Math.max(maxDiff, Math.abs(one[i] - two[i]));
    expect(maxDiff).toBeGreaterThan(0.1);
  });

  test('every sample is finite and within range', () => {
    const out = renderPatch(simple(), SR);
    for (const v of out) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });

  test('hits the normalize target', () => {
    expect(measure(renderPatch(simple({ normalize: { peak: 0.5 } }), SR)).peak).toBeCloseTo(0.5, 3);
  });

  test('an rms target is delivered by a render', () => {
    const out = renderPatch(
      simple({ normalize: { rms: 0.2 }, layers: [{ source: { kind: 'sine', hz: 200 }, env: SUSTAIN }] }),
      SR,
    );
    expect(measure(out).rms).toBeCloseTo(0.2, 3);
  });

  test('a layer with startMs is silent before it starts', () => {
    const delayed = simple({
      durationMs: 400,
      layers: [
        { startMs: 200, source: { kind: 'sine', hz: 440 }, env: { attackMs: 1, decayMs: 199 } },
      ],
    });
    const out = renderPatch(delayed, SR);
    const startSample = Math.round((200 * SR) / 1000);
    for (let i = 0; i < startSample; i++) expect(out[i]).toBe(0);
    expect(Math.max(...Array.from(out.subarray(startSample)).map(Math.abs))).toBeGreaterThan(0.1);
  });

  test('overlapping layers are both mixed in: energy at both frequencies', () => {
    const two = simple({
      normalize: { peak: 1 },
      layers: [
        { source: { kind: 'sine', hz: 200 }, env: SUSTAIN },
        { source: { kind: 'sine', hz: 900 }, env: SUSTAIN },
      ],
    });
    const out = renderPatch(two, SR);
    // Each sine contributes about half of the normalized peak; a dropped layer leaves ~0 at its bin.
    expect(amplitudeAt(out, 200, SR)).toBeGreaterThan(0.3);
    expect(amplitudeAt(out, 900, SR)).toBeGreaterThan(0.3);
    // A frequency neither layer contains stays quiet.
    expect(amplitudeAt(out, 550, SR)).toBeLessThan(0.05);
  });

  test('layers in separate time windows both appear in the mix', () => {
    // Each layer decays to silence in 100 ms, so window A (0-100) and window B (200-300) are disjoint.
    const decay = { attackMs: 0, decayMs: 100, sustain: 0 };
    const patch = simple({
      durationMs: 400,
      normalize: { peak: 1 },
      layers: [
        { source: { kind: 'sine', hz: 200 }, env: decay },
        { startMs: 200, source: { kind: 'sine', hz: 900 }, env: decay },
      ],
    });
    const out = renderPatch(patch, SR);
    expect(peakIn(out, 0, 100)).toBeGreaterThan(0.9);
    expect(peakIn(out, 200, 300)).toBeGreaterThan(0.9);
    expect(peakIn(out, 110, 190)).toBe(0);
  });

  test('gain scales a layer: a 0.5 gain layer is half as loud as its unity neighbour', () => {
    const decay = { attackMs: 0, decayMs: 100, sustain: 0 };
    const patch = simple({
      durationMs: 400,
      normalize: { peak: 1 },
      layers: [
        { source: { kind: 'sine', hz: 200 }, env: decay, gain: 1 },
        { startMs: 200, source: { kind: 'sine', hz: 900 }, env: decay, gain: 0.5 },
      ],
    });
    const out = renderPatch(patch, SR);
    const loud = peakIn(out, 0, 100);
    const quiet = peakIn(out, 200, 300);
    expect(loud).toBeCloseTo(1, 1);
    expect(quiet / loud).toBeCloseTo(0.5, 1);
  });

  test('a gain of 0 mutes a layer', () => {
    const patch = simple({
      normalize: { peak: 1 },
      layers: [
        { source: { kind: 'sine', hz: 200 }, env: SUSTAIN },
        { source: { kind: 'sine', hz: 900 }, env: SUSTAIN, gain: 0 },
      ],
    });
    const out = renderPatch(patch, SR);
    expect(amplitudeAt(out, 200, SR)).toBeGreaterThan(0.9);
    expect(amplitudeAt(out, 900, SR)).toBeLessThan(0.05);
  });

  test('the tail fades out so playback does not click', () => {
    const out = renderPatch(
      simple({ layers: [{ source: { kind: 'sine', hz: 200 }, env: SUSTAIN }] }),
      SR,
    );
    expect(Math.abs(out[out.length - 1])).toBeLessThan(0.02);
    const beforeFade = out.length - Math.round((FADE_OUT_MS * SR) / 1000) - 1;
    expect(Math.abs(out[beforeFade])).toBeGreaterThan(0.1);
  });

  test('the final sample is exactly zero', () => {
    for (const hz of [200, 441, 1000]) {
      const out = renderPatch(
        simple({ layers: [{ source: { kind: 'sine', hz }, env: SUSTAIN }] }),
        SR,
      );
      expect(out[out.length - 1]).toBe(0);
    }
  });

  test('the fade runs before normalization: a peak inside the fade window still hits the target', () => {
    // A 1.25 Hz sine peaks at the very end of 200 ms, and a slow attack keeps the envelope rising,
    // so the loudest pre-fade sample sits inside the 3 ms fade window.
    const out = renderPatch(
      simple({
        normalize: { peak: 0.5 },
        layers: [{ source: { kind: 'sine', hz: 1.25 }, env: { attackMs: 199, decayMs: 0, sustain: 1 } }],
      }),
      SR,
    );
    expect(measure(out).peak).toBeCloseTo(0.5, 6);
    expect(out[out.length - 1]).toBe(0);
  });

  test('an rms render never exceeds the 0.99 ceiling', () => {
    const out = renderPatch(
      simple({ normalize: { rms: 0.9 }, layers: [{ source: { kind: 'sine', hz: 200 }, env: SUSTAIN }] }),
      SR,
    );
    expect(measure(out).peak).toBeLessThanOrEqual(0.99 + 1e-6);
  });

  test('an invalid patch throws with the offending paths', () => {
    expect(() => renderPatch(simple({ durationMs: -1 }), SR)).toThrow(/durationMs/);
  });
});
