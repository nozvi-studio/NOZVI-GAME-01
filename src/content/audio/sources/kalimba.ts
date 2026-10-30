import type { Patch } from '../../../engine/core/audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * The one instrument of the board: a kalimba tine. Every sound a piece makes in
 * play (lift, set down, lock in, hand back, the victory run) is this voice at the
 * piece's own note, so the player hears one thing being played, not a set of effects.
 *
 * This is the short form, for touch: lifting, setting down, handing back. The
 * first version was warm and dull, a bare sine and a low filter with almost
 * nothing above 2 kHz. A real tine is clear and airy: a pure fundamental, a
 * ringing metallic partial at about 6.3x (the second bending mode of a tine
 * clamped at one end) that dies fast and gives the "plink", a thumb tick of
 * band-passed noise, and a filter left open so that brightness survives. The
 * partials stay low enough that, played up to three times faster, nothing
 * reaches the Nyquist limit and turns shrill. Written an octave above the music
 * root and played at a rate to reach the piece's note.
 */
export const kalimba: Patch = {
  durationMs: 900,
  seed: 109,
  layers: [
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 1, decayMs: 850, curve: 'exp' },
    },
    {
      // A whisper sharp of the first: enough beat to feel alive, not enough to go warm.
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 1.002 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 1, decayMs: 600, curve: 'exp' },
      gain: 0.25,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 6.27 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 0, decayMs: 230, curve: 'exp' },
      gain: 0.6,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 2 * 2 },
      filter: { kind: 'lowpass', hz: 9000, q: 0.7 },
      env: { attackMs: 0, decayMs: 260, curve: 'exp' },
      gain: 0.18,
    },
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'bandpass', hz: 4200, q: 1.2 },
      env: { attackMs: 0, decayMs: 14, curve: 'exp' },
      gain: 0.16,
    },
  ],
  normalize: { peak: 0.4 },
};
