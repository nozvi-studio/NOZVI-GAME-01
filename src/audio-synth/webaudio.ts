/**
 * The only part of the engine that touches the Web Audio API.
 *
 * It is still portable: it imports nothing outside this folder and is
 * generic over the caller's key type, so it knows nothing about any
 * particular game's sound names.
 */
import type { Patch } from './patch.ts';
import { renderPatch } from './render.ts';

export function toAudioBuffer(samples: Float32Array, ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.max(1, samples.length), ctx.sampleRate);
  buffer.copyToChannel(samples, 0);
  return buffer;
}

/**
 * Renders every patch once. A handful of short effects costs a few
 * milliseconds in total; call it at start-up and keep the result.
 */
export function renderAll<K extends string>(
  patches: Record<K, Patch>,
  ctx: BaseAudioContext,
): Record<K, AudioBuffer> {
  const out = {} as Record<K, AudioBuffer>;
  for (const key of Object.keys(patches) as K[]) {
    out[key] = toAudioBuffer(renderPatch(patches[key], ctx.sampleRate), ctx);
  }
  return out;
}
