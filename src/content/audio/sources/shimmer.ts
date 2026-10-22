import type { Patch } from '../../../audio-synth/patch.ts';
import { MUSIC_ROOT_HZ } from '../root.ts';

/**
 * Bright sparkle. Three high partials of the root, each drifting a couple of
 * hertz over its life so they beat gently against one another instead of
 * sitting still.
 */
export const shimmer: Patch = {
  durationMs: 900,
  seed: 106,
  layers: [
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 6, glideToHz: MUSIC_ROOT_HZ * 6 + 2 },
      env: { attackMs: 25, decayMs: 865, curve: 'exp' },
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 8, glideToHz: MUSIC_ROOT_HZ * 8 - 3 },
      env: { attackMs: 40, decayMs: 850, curve: 'exp' },
      gain: 0.7,
    },
    {
      source: { kind: 'sine', hz: MUSIC_ROOT_HZ * 10, glideToHz: MUSIC_ROOT_HZ * 10 + 4 },
      env: { attackMs: 60, decayMs: 830, curve: 'exp' },
      gain: 0.5,
    },
  ],
  normalize: { peak: 0.38 },
};
