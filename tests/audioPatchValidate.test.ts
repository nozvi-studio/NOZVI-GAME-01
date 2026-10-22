import { describe, expect, test } from 'vitest';
import { validatePatch } from '../src/audio-synth/patch.ts';
import type { Patch } from '../src/audio-synth/patch.ts';

const SR = 44100;

const good = (): Patch => ({
  durationMs: 200,
  seed: 1,
  layers: [{ source: { kind: 'sine', hz: 440 }, env: { attackMs: 1, decayMs: 190 } }],
  normalize: { peak: 0.8 },
});

describe('validatePatch', () => {
  test('a well-formed patch has no issues', () => {
    expect(validatePatch(good(), SR)).toEqual([]);
  });

  test('duration must be positive', () => {
    const patch = { ...good(), durationMs: 0 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('durationMs');
  });

  test('at least one layer is required', () => {
    const patch = { ...good(), layers: [] };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers');
  });

  test('a layer cannot start after the patch ends', () => {
    const patch = good();
    patch.layers[0].startMs = 500;
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].startMs');
  });

  test('a filter cutoff above Nyquist is rejected', () => {
    const patch = good();
    patch.layers[0].filter = { kind: 'lowpass', hz: 30000 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].filter.hz');
  });

  test('a sweep target above Nyquist is rejected', () => {
    const patch = good();
    patch.layers[0].filter = { kind: 'lowpass', hz: 1000, sweepToHz: 40000 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].filter.sweepToHz');
  });

  test('non-finite numbers are rejected wherever they appear', () => {
    const patch = good();
    patch.layers[0].source = { kind: 'sine', hz: Number.NaN };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].source.hz');
  });

  test('normalize targets must be positive and at most one', () => {
    expect(validatePatch({ ...good(), normalize: { peak: 0 } }, SR).map((i) => i.path)).toContain(
      'normalize.peak',
    );
    expect(validatePatch({ ...good(), normalize: { rms: 1.5 } }, SR).map((i) => i.path)).toContain(
      'normalize.rms',
    );
  });

  test('envelope times cannot be negative', () => {
    const patch = good();
    patch.layers[0].env = { attackMs: -1, decayMs: 10 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].env.attackMs');
  });

  test('every issue carries a human-readable message', () => {
    const patch = { ...good(), durationMs: -5 };
    for (const issue of validatePatch(patch, SR)) expect(issue.message.length).toBeGreaterThan(0);
  });

  test('an invalid sample rate is rejected', () => {
    for (const rate of [0, -44100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validatePatch(good(), rate).map((i) => i.path)).toContain('sampleRate');
    }
  });

  test('an FM modulator above Nyquist is rejected even when the carrier is fine', () => {
    const patch = good();
    patch.layers[0].source = { kind: 'fm', carrierHz: 4000, ratio: 8, index: 1 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].source.ratio');
    patch.layers[0].source = { kind: 'fm', carrierHz: 4000, ratio: 3, index: 1 };
    expect(validatePatch(patch, SR)).toEqual([]);
  });

  test('a glide target above Nyquist is rejected', () => {
    const patch = good();
    patch.layers[0].source = { kind: 'sine', hz: 440, glideToHz: 30000 };
    expect(validatePatch(patch, SR).map((i) => i.path)).toContain('layers[0].source.glideToHz');
  });
});
