import { describe, expect, test } from 'vitest';
import {
  applyBiquad,
  envelope,
  fmOsc,
  mulberry32,
  noise,
  osc,
} from '../src/audio-synth/dsp.ts';

const SR = 44100;

function rms(xs: Float32Array): number {
  let sum = 0;
  for (const x of xs) sum += x * x;
  return Math.sqrt(sum / xs.length);
}

describe('mulberry32', () => {
  test('same seed yields the same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const left = [a(), a(), a(), a()];
    const right = [b(), b(), b(), b()];
    expect(left).toEqual(right);
  });

  test('different seeds diverge, and values stay in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('noise', () => {
  test('white noise fills the range and is reproducible', () => {
    const first = noise('white', 2048, mulberry32(3));
    const second = noise('white', 2048, mulberry32(3));
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(rms(first)).toBeGreaterThan(0.4);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(-1);
  });

  test('pink noise has less high-frequency energy than white', () => {
    const white = noise('white', 8192, mulberry32(5));
    const pink = noise('pink', 8192, mulberry32(5));
    // A difference filter approximates high-frequency content.
    const highs = (xs: Float32Array) => {
      let sum = 0;
      for (let i = 1; i < xs.length; i++) sum += (xs[i] - xs[i - 1]) ** 2;
      return Math.sqrt(sum / (xs.length - 1));
    };
    expect(highs(pink)).toBeLessThan(highs(white));
  });
});

describe('envelope', () => {
  test('a pure decay starts at one and ends at zero', () => {
    const env = envelope({ attackMs: 0, decayMs: 100 }, 4410, SR);
    expect(env[0]).toBeCloseTo(1, 5);
    expect(env[env.length - 1]).toBeCloseTo(0, 5);
  });

  test('attack rises from zero and reaches one', () => {
    const env = envelope({ attackMs: 50, decayMs: 50 }, 4410, SR);
    expect(env[0]).toBeCloseTo(0, 5);
    expect(Math.max(...env)).toBeCloseTo(1, 3);
  });

  test('an exponential decay is monotonic and stays below the linear one', () => {
    const lin = envelope({ attackMs: 0, decayMs: 100, curve: 'lin' }, 4410, SR);
    const exp = envelope({ attackMs: 0, decayMs: 100, curve: 'exp' }, 4410, SR);
    for (let i = 1; i < exp.length; i++) expect(exp[i]).toBeLessThanOrEqual(exp[i - 1] + 1e-7);
    expect(exp[2205]).toBeLessThan(lin[2205]);
  });

  test('sustain holds, then release falls to zero', () => {
    const env = envelope(
      { attackMs: 0, decayMs: 10, sustain: 0.5, releaseMs: 10 },
      Math.round(SR * 0.1),
      SR,
    );
    expect(env[Math.round(SR * 0.05)]).toBeCloseTo(0.5, 3);
    expect(env[env.length - 1]).toBeCloseTo(0, 5);
  });
});

describe('osc', () => {
  test('a sine has the expected amplitude and near-zero mean', () => {
    const wave = osc('sine', 440, 440, SR, SR);
    expect(Math.max(...wave)).toBeCloseTo(1, 1);
    expect(rms(wave)).toBeCloseTo(Math.SQRT1_2, 2);
    const mean = wave.reduce((a, b) => a + b, 0) / wave.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });

  test('a square only takes two values', () => {
    const wave = osc('square', 100, 100, 1000, SR);
    expect(new Set(Array.from(wave))).toEqual(new Set([1, -1]));
  });

  test('a glide ends near the target frequency', () => {
    const wave = osc('sine', 100, 800, SR, SR);
    const crossings = (from: number, to: number) => {
      let n = 0;
      for (let i = from + 1; i < to; i++) if (wave[i - 1] < 0 && wave[i] >= 0) n++;
      return n;
    };
    // The last tenth of a second should hold roughly the target frequency.
    expect(crossings(SR - 4410, SR)).toBeGreaterThan(60);
  });
});

describe('fmOsc', () => {
  test('zero index collapses to a plain sine', () => {
    const plain = osc('sine', 300, 300, 1000, SR);
    const fm = fmOsc(300, 3.5, 0, null, 1000, SR);
    for (let i = 0; i < 1000; i++) expect(fm[i]).toBeCloseTo(plain[i], 5);
  });

  test('a non-zero index adds partials', () => {
    const plain = osc('sine', 300, 300, 4096, SR);
    const fm = fmOsc(300, 3.5, 6, null, 4096, SR);
    let diff = 0;
    for (let i = 0; i < 4096; i++) diff += Math.abs(fm[i] - plain[i]);
    expect(diff / 4096).toBeGreaterThan(0.1);
  });
});

describe('applyBiquad', () => {
  test('a lowpass passes a tone below its cutoff and blocks one above', () => {
    const low = osc('sine', 100, 100, SR, SR);
    const high = osc('sine', 8000, 8000, SR, SR);
    const passed = applyBiquad(low, 'lowpass', 500, 500, 0.707, SR);
    const blocked = applyBiquad(high, 'lowpass', 500, 500, 0.707, SR);
    expect(rms(passed)).toBeGreaterThan(rms(low) * 0.8);
    expect(rms(blocked)).toBeLessThan(rms(high) * 0.05);
  });

  test('a highpass does the opposite', () => {
    const low = osc('sine', 100, 100, SR, SR);
    const high = osc('sine', 8000, 8000, SR, SR);
    expect(rms(applyBiquad(low, 'highpass', 2000, 2000, 0.707, SR))).toBeLessThan(rms(low) * 0.05);
    expect(rms(applyBiquad(high, 'highpass', 2000, 2000, 0.707, SR))).toBeGreaterThan(rms(high) * 0.8);
  });

  test('a sweep lands on the end cutoff', () => {
    const high = osc('sine', 6000, 6000, SR, SR);
    const swept = applyBiquad(high, 'lowpass', 12000, 400, 0.707, SR);
    const head = swept.subarray(0, 4410);
    const tail = swept.subarray(SR - 4410);
    expect(rms(tail)).toBeLessThan(rms(head) * 0.2);
  });

  test('the output is finite everywhere', () => {
    const out = applyBiquad(noise('white', 4096, mulberry32(9)), 'bandpass', 1000, 1000, 2, SR);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('DSP boundaries', () => {
  test('empty buffers stay empty', () => {
    expect(noise('pink', 0, mulberry32(1))).toHaveLength(0);
    expect(envelope({ attackMs: 0, decayMs: 0 }, 0, SR)).toHaveLength(0);
    expect(osc('triangle', 100, 200, 0, SR)).toHaveLength(0);
    expect(fmOsc(100, 2, 1, null, 0, SR)).toHaveLength(0);
    expect(applyBiquad(new Float32Array(), 'lowpass', 100, 200, 1, SR)).toHaveLength(0);
  });

  test('short decay includes both endpoints and a one-sample decay reaches its target', () => {
    expect(Array.from(envelope({ attackMs: 0, decayMs: 3 }, 3, 1000))).toEqual([1, 0.5, 0]);
    expect(Array.from(envelope({ attackMs: 0, decayMs: 1 }, 1, 1000))).toEqual([0]);
  });

  test('a short release reaches zero, including a one-sample release', () => {
    expect(Array.from(envelope({ attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 3 }, 5, 1000))).toEqual([1, 1, 1, 0.5, 0]);
    expect(Array.from(envelope({ attackMs: 0, decayMs: 0, sustain: 1, releaseMs: 1 }, 3, 1000))).toEqual([1, 1, 0]);
  });

  test('a zero FM index envelope removes modulation', () => {
    const plain = osc('sine', 300, 300, 1000, SR);
    expect(fmOsc(300, 3.5, 6, new Float32Array(1000), 1000, SR)).toEqual(plain);
  });

  test('triangle and saw waveforms have their expected phase extrema', () => {
    expect(Array.from(osc('triangle', 250, 250, 4, 1000))).toEqual([1, 0, -1, 0]);
    expect(Array.from(osc('saw', 250, 250, 4, 1000))).toEqual([-1, -0.5, 0, 0.5]);
  });
});
