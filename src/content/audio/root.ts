/**
 * The tonal centre every pitched effect is built on: D4.
 *
 * Set this to the root of whatever music the reviewer sources, and the bell
 * is in tune by construction. There is nothing to measure.
 *
 * It sits in its own file because the patches that use it are themselves
 * imported by index.ts; a constant exported from index.ts would make that
 * graph circular and throw at import time.
 */
export const MUSIC_ROOT_HZ = 293.66;
