import type { Patch } from '../../../audio-synth/patch.ts';

/**
 * Low, airy breath. Pink noise through a narrow bandpass, with a slow attack
 * so it swells rather than starts. An rms target keeps it present without a
 * peak that fights the sharper cues.
 */
export const hollow: Patch = {
  durationMs: 900,
  seed: 105,
  layers: [
    {
      source: { kind: 'noise', color: 'pink' },
      filter: { kind: 'bandpass', hz: 320, q: 1.4 },
      env: { attackMs: 300, decayMs: 560, curve: 'lin' },
    },
  ],
  normalize: { rms: 0.12 },
};
