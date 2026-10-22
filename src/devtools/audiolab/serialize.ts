import type { Patch } from '../../audio-synth/patch.ts';

/**
 * The eight steps G2 uses for snapped pieces, in semitones relative to the
 * root. The first step is below the root and the last is +12 above it, so the
 * ladder as a whole spans 17 semitones; only the last step is an octave over
 * the root.
 */
export const PENTATONIC_STEPS: readonly number[] = [-5, -3, 0, 2, 4, 7, 9, 12];

export function ladderRates(): number[] {
  return PENTATONIC_STEPS.map((semitones) => 2 ** (semitones / 12));
}

/**
 * Prints a patch as the body of a source file.
 *
 * JSON.stringify drops undefined optional fields, which is exactly what we
 * want: the output is the patch, with nothing to clean up by hand.
 */
export function patchToTypeScript(name: string, patch: Patch): string {
  return `export const ${name}: Patch = ${JSON.stringify(patch, null, 2)};\n`;
}
