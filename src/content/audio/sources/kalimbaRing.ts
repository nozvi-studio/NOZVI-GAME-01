import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * The same kalimba tine let ring: the note a piece locks in with, and the notes of
 * the victory run. Same bright strike as `kalimba` (see there for why it is open
 * and airy), but the body lasts about three and a half seconds, with an octave that
 * blooms under it and a high partial that shimmers away slowly, so notes struck one after
 * another pile up into a chord instead of replacing each other.
 */
export const kalimbaRing: Patch = {
  durationMs: 3600,
  seed: 111,
  layers: [
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 1, decayMs: 3500, curve: 'exp' },
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 1.002 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 1, decayMs: 2800, curve: 'exp' },
      gain: 0.3,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 2 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 12, decayMs: 2600, curve: 'exp' },
      gain: 0.26,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 4 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 2, decayMs: 1200, curve: 'exp' },
      gain: 0.09,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 6.27 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 0, decayMs: 260, curve: 'exp' },
      gain: 0.5,
    },
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'bandpass', hz: 4200, q: 1.2 },
      env: { attackMs: 0, decayMs: 14, curve: 'exp' },
      gain: 0.13,
    },
  ],
  normalize: { peak: 0.4 },
};
