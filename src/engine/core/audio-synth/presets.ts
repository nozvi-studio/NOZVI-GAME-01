/**
 * Three starting points, so a new project does not begin from an empty file.
 * Copy one, change the numbers, listen. Mirror's own eight patches in
 * src/content/audio/sources/ are fuller worked examples.
 */
import type { Patch } from './patch.ts';

/** A short, dry UI click. Raise the highpass for something thinner. */
export const clickPreset: Patch = {
  durationMs: 100,
  seed: 1,
  layers: [
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'highpass', hz: 4000, q: 0.8 },
      env: { attackMs: 1, decayMs: 50, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.5 },
};

/**
 * A struck crystal bell. A whole-number ratio keeps the partials on the
 * harmonic series and a low index adds few sidebands, which together read as
 * glass. An inharmonic ratio (3.5) with a high index (6) reads as clanging
 * metal instead; that was tried first and judged too harsh by ear. The index
 * collapses within 110 ms so the strike has an edge and the tail is pure.
 */
export const bellPreset: Patch = {
  durationMs: 1200,
  seed: 2,
  layers: [
    {
      source: {
        kind: 'fm',
        carrierHz: 440,
        ratio: 3,
        index: 2.5,
        indexEnv: { attackMs: 0, decayMs: 110, curve: 'exp' },
      },
      env: { attackMs: 2, decayMs: 1198, curve: 'exp' },
    },
  ],
  normalize: { peak: 0.9 },
};

/** Air moving past. Sweep the bandpass the other way for a rising whoosh. */
export const whooshPreset: Patch = {
  durationMs: 600,
  seed: 3,
  layers: [
    {
      source: { kind: 'noise', color: 'white' },
      filter: { kind: 'bandpass', hz: 3000, q: 1.2, sweepToHz: 600 },
      env: { attackMs: 80, decayMs: 500, curve: 'lin' },
    },
  ],
  normalize: { peak: 0.5 },
};
