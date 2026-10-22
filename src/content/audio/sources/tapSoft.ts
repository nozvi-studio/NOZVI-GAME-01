import type { Patch } from '../../../audio-synth/patch.ts';

/** Soft, low, muted tap: a short sine with the top rolled off. */
export const tapSoft: Patch = {
  durationMs: 220,
  seed: 103,
  layers: [
    {
      source: { kind: 'sine', hz: 180 },
      filter: { kind: 'lowpass', hz: 750, q: 0.7 },
      env: { attackMs: 6, decayMs: 120, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.5 },
};
