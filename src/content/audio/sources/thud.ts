import type { Patch } from '../../../audio-synth/patch.ts';

/**
 * Dull, blocked knock. A falling sine gives the weight; a short lowpassed
 * noise layer on top gives the contact its edge.
 */
export const thud: Patch = {
  durationMs: 350,
  seed: 104,
  layers: [
    {
      source: { kind: 'sine', hz: 120, glideToHz: 60 },
      env: { attackMs: 4, decayMs: 220, curve: 'exp' },
    },
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'lowpass', hz: 320, q: 0.7 },
      env: { attackMs: 1, decayMs: 90, curve: 'exp' },
      gain: 0.28,
    },
  ],
  normalize: { peak: 0.68 },
};
