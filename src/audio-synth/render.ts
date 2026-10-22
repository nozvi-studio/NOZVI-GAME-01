/**
 * Turns a Patch into samples.
 *
 * Per layer: build the source, colour it with the filter, shape it with the
 * envelope, scale by gain, and add it into the mix at its start offset. Then
 * fade the last few milliseconds so playback cannot click, and normalize the
 * faded sum so the requested loudness is what actually comes out.
 */
import { applyBiquad, envelope, fmOsc, mulberry32, noise, osc } from './dsp.ts';
import { validatePatch } from './patch.ts';
import type { Layer, Patch } from './patch.ts';
import { applyNormalize } from './normalize.ts';

export const FADE_OUT_MS = 3;

/** Each layer gets its own PRNG stream, so adding a layer does not disturb earlier ones. */
const SEED_STRIDE = 7919;

function renderLayer(layer: Layer, seed: number, n: number, sampleRate: number): Float32Array {
  const src = layer.source;
  let signal: Float32Array;

  if (src.kind === 'noise') {
    signal = noise(src.color, n, mulberry32(seed));
  } else if (src.kind === 'fm') {
    const indexEnv = src.indexEnv ? envelope(src.indexEnv, n, sampleRate) : null;
    signal = fmOsc(src.carrierHz, src.ratio, src.index, indexEnv, n, sampleRate);
  } else {
    signal = osc(src.kind, src.hz, src.glideToHz ?? src.hz, n, sampleRate);
  }

  if (layer.filter) {
    const f = layer.filter;
    signal = applyBiquad(signal, f.kind, f.hz, f.sweepToHz ?? f.hz, f.q ?? 0.707, sampleRate);
  }

  const env = envelope(layer.env, n, sampleRate);
  const gain = layer.gain ?? 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = signal[i] * env[i] * gain;
  return out;
}

/** Linear fade over the last FADE_OUT_MS; the ramp is sized so the final sample is exactly 0. */
function fadeOut(mix: Float32Array, sampleRate: number): void {
  const fade = Math.min(mix.length, Math.round((FADE_OUT_MS * sampleRate) / 1000));
  for (let i = 0; i < fade; i++) {
    const idx = mix.length - fade + i;
    mix[idx] = fade <= 1 ? 0 : mix[idx] * (1 - i / (fade - 1));
  }
  // Assigning (rather than multiplying) avoids a -0 from a negative sample.
  if (mix.length > 0) mix[mix.length - 1] = 0;
}

export function renderPatch(patch: Patch, sampleRate: number): Float32Array {
  const issues = validatePatch(patch, sampleRate);
  if (issues.length > 0) {
    throw new Error(
      `invalid patch: ${issues.map((i) => `${i.path} (${i.message})`).join('; ')}`,
    );
  }

  const n = Math.round((patch.durationMs * sampleRate) / 1000);
  const mix = new Float32Array(n);

  patch.layers.forEach((layer, index) => {
    const start = Math.round(((layer.startMs ?? 0) * sampleRate) / 1000);
    const length = n - start;
    if (length <= 0) return;
    const rendered = renderLayer(layer, patch.seed + index * SEED_STRIDE, length, sampleRate);
    for (let i = 0; i < length; i++) mix[start + i] += rendered[i];
  });

  fadeOut(mix, sampleRate);
  return applyNormalize(mix, patch.normalize);
}
