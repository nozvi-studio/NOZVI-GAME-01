import type { NormalizeTarget } from './patch.ts';

export type Measurement = { peak: number; rms: number };

/** Hard limit applied after an rms target, so a quiet-but-spiky patch cannot clip. */
export const CEILING = 0.99;

export function measure(samples: Float32Array): Measurement {
  let peak = 0;
  let sum = 0;
  for (const v of samples) {
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sum += v * v;
  }
  return { peak, rms: samples.length === 0 ? 0 : Math.sqrt(sum / samples.length) };
}

/**
 * Always returns a new array; silence comes back as an all-zero copy rather than divided by zero.
 * A peak target lands the loudest sample on the target. An rms target applies the
 * exact rms scale, then hard-limits each sample to +/-CEILING, so the requested
 * loudness is never silently reduced to make room for a spike.
 */
export function applyNormalize(samples: Float32Array, target: NormalizeTarget): Float32Array {
  const { peak, rms } = measure(samples);
  const out = new Float32Array(samples.length);
  if ('peak' in target) {
    if (peak === 0) return out;
    const scale = target.peak / peak;
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
    return out;
  }
  if (rms === 0) return out;
  const scale = target.rms / rms;
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-CEILING, Math.min(CEILING, samples[i] * scale));
  }
  return out;
}
