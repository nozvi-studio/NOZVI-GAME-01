/**
 * Mirror's sound effects, as patches rather than files.
 *
 * The engine that renders these lives in src/audio-synth/ and knows nothing
 * about Mirror. This file is the Mirror-side content, the same way
 * src/content/sources/ holds level content.
 */
import type { Patch } from '../../audio-synth/patch.ts';
import { bell } from './sources/bell.ts';
import { breath } from './sources/breath.ts';
import { hollow } from './sources/hollow.ts';
import { pluck } from './sources/pluck.ts';
import { shimmer } from './sources/shimmer.ts';
import { stingerWin } from './sources/stingerWin.ts';
import { swish } from './sources/swish.ts';
import { tapSoft } from './sources/tapSoft.ts';
import { thud } from './sources/thud.ts';
import { tick } from './sources/tick.ts';

export type SfxKey =
  | 'bell'
  | 'pluck'
  | 'breath'
  | 'tick'
  | 'tap-soft'
  | 'thud'
  | 'hollow'
  | 'shimmer'
  | 'swish'
  | 'stinger-win';

export const SFX_KEYS: readonly SfxKey[] = [
  'bell',
  'pluck',
  'breath',
  'tick',
  'tap-soft',
  'thud',
  'hollow',
  'shimmer',
  'swish',
  'stinger-win',
];

export { MUSIC_ROOT_HZ } from './root.ts';

export const SFX_PATCHES: Record<SfxKey, Patch> = {
  bell,
  pluck,
  breath,
  tick,
  'tap-soft': tapSoft,
  thud,
  hollow,
  shimmer,
  swish,
  'stinger-win': stingerWin,
};
