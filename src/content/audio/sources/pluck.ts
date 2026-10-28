import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * A piece set down on the board without being right yet: a soft kalimba pluck.
 *
 * It is played at a pentatonic pitch chosen from where the piece landed, so a
 * wrong drop is still a pleasant note and every spot on the board has its own.
 * It never rises or resolves; that belongs to the bell, which only a piece on
 * its target earns. A sine with a quiet second partial and a whisper of pink
 * noise for the finger keeps it round, with no ring to outstay the next move.
 */
export const pluck: Patch = {
  durationMs: 900,
  seed: 109,
  layers: [
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 },
      filter: { kind: 'lowpass', hz: 3200, q: 0.7 },
      env: { attackMs: 2, decayMs: 880, curve: 'exp' },
    },
    {
      // A hair sharp of the first, so the pair beats slowly like two tines of a hand-made kalimba.
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 1.004 },
      filter: { kind: 'lowpass', hz: 2800, q: 0.7 },
      env: { attackMs: 3, decayMs: 760, curve: 'exp' },
      gain: 0.55,
    },
    {
      // The inharmonic bar mode (about 2.76x) that makes a tine sound struck rather than synthesised.
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 2.76 },
      filter: { kind: 'lowpass', hz: 4200, q: 0.7 },
      env: { attackMs: 1, decayMs: 90, curve: 'exp' },
      gain: 0.14,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 8 },
      filter: { kind: 'lowpass', hz: 5200, q: 0.7 },
      env: { attackMs: 1, decayMs: 140, curve: 'exp' },
      gain: 0.22,
    },
    {
      source: { kind: 'noise', color: 'pink' },
      filter: { kind: 'bandpass', hz: 2400, q: 1.1 },
      env: { attackMs: 0, decayMs: 14, curve: 'exp' },
      gain: 0.12,
    },
  ],
  normalize: { peak: 0.4 },
};
