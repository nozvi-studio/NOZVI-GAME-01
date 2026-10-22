import type { Patch } from '../../../audio-synth/patch.ts';

/** Light air swish, falling: white noise through a bandpass sweeping downward. */
export const swish: Patch = {
  durationMs: 520,
  seed: 107,
  layers: [
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'bandpass', hz: 2800, q: 1, sweepToHz: 600 },
      env: { attackMs: 60, decayMs: 440, curve: 'lin' },
    },
  ],
  normalize: { peak: 0.4 },
};
