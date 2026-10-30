import type { Patch } from '../../../engine/core/audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Victory chord: four soft voices entering in turn and resolving on the octave,
 * the same major-pentatonic steps (0, 4, 7, 12 semitones) the in-level notes use.
 *
 * It was too shrill: the voices sat two octaves above the root (1.2 kHz at the
 * top) with a hard FM strike, and the quick 180 ms entries read as a row of
 * pings. Now the chord lives around the root (293 to 587 Hz), the strike is a
 * whisper of FM with a rounded 30 ms attack, a lowpass keeps the top warm, and
 * the voices open slowly enough to blend into one swell that resolves.
 */
const STEP = (semitones: number) => MUSIC_ROOT_HZ * 2 ** (semitones / 12);

const voice = (semitones: number, startMs: number, decayMs: number, gain: number) =>
  ({
    startMs,
    source: {
      kind: 'fm' as const,
      carrierHz: STEP(semitones),
      ratio: 2,
      index: 0.9,
      indexEnv: { attackMs: 0, decayMs: 90, curve: 'exp' as const },
    },
    filter: { kind: 'lowpass' as const, hz: 2600, q: 0.7 },
    env: { attackMs: 30, decayMs, curve: 'exp' as const },
    gain,
  });

export const stingerWin: Patch = {
  durationMs: 3600,
  seed: 108,
  layers: [
    voice(0, 0, 3200, 1),
    voice(4, 260, 3000, 0.85),
    voice(7, 520, 2800, 0.75),
    voice(12, 900, 2700, 0.8),
  ],
  normalize: { peak: 0.5 },
};
