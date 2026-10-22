import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Crystal bell, one clear pitch, an octave above the music root.
 *
 * Tuned for clarity rather than weight. A whole-number ratio of 3 keeps the
 * partials on the harmonic series, which reads as struck crystal instead of
 * the clangier metal an inharmonic ratio gives, and a low modulation index
 * means few sidebands to begin with. The index collapses within 110 ms, so
 * there is just enough edge to hear the strike before the tail goes pure.
 * The lowpass trims the very top, where the harshness lives.
 *
 * Values below are the reviewer's, set by ear in the Audio Lab. carrierHz is
 * written as a multiple of MUSIC_ROOT_HZ rather than the literal 587.32 the
 * Lab emits, so the bell follows the music if its key ever changes.
 */
export const bell: Patch = {
  durationMs: 1400,
  seed: 101,
  layers: [
    {
      source: {
        kind: 'fm',
        carrierHz: MUSIC_ROOT_HZ * 2,
        ratio: 3,
        index: 2.5,
        indexEnv: { attackMs: 0, decayMs: 110, curve: 'exp' },
      },
      filter: { kind: 'lowpass', hz: 6500, q: 0.7 },
      env: { attackMs: 5, decayMs: 1395, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.32 },
};
