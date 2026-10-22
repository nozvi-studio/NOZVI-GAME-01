import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Very light glass tap. This is the most-heard sound in the game — it plays on
 * every lift, every rotate and every UI press — so it has to stay out of the way.
 *
 * It is a pitched ping, not a noise burst. Highpassed white noise reads as a hiss
 * and is the harshest way to make a tick; two octaves above the music root with a
 * whisper of FM gives the same "glass" cue while sitting inside the key, so it
 * blends with the music instead of cutting across it.
 *
 * Values below are the reviewer's, set by ear in the Audio Lab. carrierHz is
 * written as a multiple of MUSIC_ROOT_HZ rather than the literal 1174.64 the
 * Lab emits, so the tick follows the music if its key ever changes.
 */
export const tick: Patch = {
  durationMs: 130,
  seed: 102,
  layers: [
    {
      source: {
        kind: 'fm',
        carrierHz: MUSIC_ROOT_HZ * 4,
        ratio: 1.3,
        index: 2.1,
        indexEnv: { attackMs: 0, decayMs: 7, curve: 'exp' },
      },
      filter: { kind: 'lowpass', hz: 4897.5, q: 0.7 },
      env: { attackMs: 0, decayMs: 99, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.35 },
};
