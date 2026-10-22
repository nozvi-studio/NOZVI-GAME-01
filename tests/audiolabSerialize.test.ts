import { describe, expect, test } from 'vitest';
import { PENTATONIC_STEPS, ladderRates, patchToTypeScript } from '../src/devtools/audiolab/serialize.ts';
import { validatePatch } from '../src/audio-synth/patch.ts';
import type { Patch } from '../src/audio-synth/patch.ts';
import { SFX_PATCHES } from '../src/content/audio/index.ts';

describe('patchToTypeScript', () => {
  test('emits an exported const with the given name', () => {
    const out = patchToTypeScript('tick', SFX_PATCHES.tick);
    expect(out).toContain('export const tick: Patch = {');
    expect(out.trimEnd().endsWith('};')).toBe(true);
  });

  test('round-trips through JSON into an equal, still-valid patch', () => {
    for (const [name, patch] of Object.entries(SFX_PATCHES)) {
      const body = patchToTypeScript(name, patch);
      const json = body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as Patch;
      expect(parsed).toEqual(JSON.parse(JSON.stringify(patch)));
      expect(validatePatch(parsed, 44100)).toEqual([]);
    }
  });

  test('omits undefined optional fields rather than printing undefined', () => {
    expect(patchToTypeScript('tick', SFX_PATCHES.tick)).not.toContain('undefined');
  });
});

describe('ladderRates', () => {
  test('matches the G2 pentatonic steps', () => {
    expect(PENTATONIC_STEPS).toEqual([-5, -3, 0, 2, 4, 7, 9, 12]);
  });

  test('every step is a major-pentatonic degree of the root', () => {
    const degrees = new Set([0, 2, 4, 7, 9]);
    for (const step of PENTATONIC_STEPS) expect(degrees.has(((step % 12) + 12) % 12)).toBe(true);
  });

  test('rates rise, the last is exactly +12 semitones and the third is the root', () => {
    const rates = ladderRates();
    expect(rates).toHaveLength(8);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    expect(rates[rates.length - 1]).toBeCloseTo(2, 10);
    expect(rates[2]).toBeCloseTo(1, 10);
  });
});
