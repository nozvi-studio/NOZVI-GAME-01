import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Picking a piece up: a short airy swell, like a breath drawn in, with a
 * faint tone of the music root under it so it sits in key.
 *
 * It replaces the glass tick on lift, which is heard on every grab and read as
 * a click. Lifting is not a result, so it should feel like touch, not a note.
 */
export const breath: Patch = {
  durationMs: 240,
  seed: 110,
  layers: [
    {
      source: { kind: 'noise', color: 'pink' },
      filter: { kind: 'bandpass', hz: 700, q: 1.2, sweepToHz: 1700 },
      env: { attackMs: 90, decayMs: 140, curve: 'lin' },
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ, glideToHz: MUSIC_ROOT_HZ * 1.5 },
      filter: { kind: 'lowpass', hz: 1400, q: 0.7 },
      env: { attackMs: 80, decayMs: 150, curve: 'lin' },
      gain: 0.35,
    },
  ],
  normalize: { peak: 0.3 },
};
