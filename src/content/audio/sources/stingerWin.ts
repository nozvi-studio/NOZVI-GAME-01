import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Victory chord: four bell voices entering in turn and resolving on the
 * octave. The steps are 0, 4, 7 and 12 semitones above the bell's own
 * register, which is the same major-pentatonic world the in-level snaps use.
 */
const STEP = (semitones: number) => MUSIC_ROOT_HZ * 2 * 2 ** (semitones / 12);

const voice = (semitones: number, startMs: number, decayMs: number) =>
  ({
    startMs,
    source: {
      kind: 'fm' as const,
      carrierHz: STEP(semitones),
      ratio: 3,
      index: 2.5,
      indexEnv: { attackMs: 0, decayMs: 120, curve: 'exp' as const },
    },
    env: { attackMs: 6, decayMs, curve: 'exp' as const },
  });

export const stingerWin: Patch = {
  durationMs: 3600,
  seed: 108,
  layers: [
    voice(0, 0, 3000),
    voice(4, 180, 2800),
    voice(7, 360, 2600),
    voice(12, 620, 2900),
  ],
  normalize: { peak: 0.82 },
};
