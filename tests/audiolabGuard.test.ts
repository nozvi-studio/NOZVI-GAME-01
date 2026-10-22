import { describe, expect, test } from 'vitest';
import { ViewMemory, formatIssues, sliderLabel, tryRender } from '../src/devtools/audiolab/guard.ts';
import type { Patch } from '../src/audio-synth/patch.ts';
import { SFX_PATCHES } from '../src/content/audio/index.ts';

const clone = (): Patch => JSON.parse(JSON.stringify(SFX_PATCHES.tick)) as Patch;

describe('tryRender', () => {
  test('renders a valid patch', () => {
    const result = tryRender(SFX_PATCHES.tick, 44100);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.samples.length).toBeGreaterThan(0);
  });

  test('returns issues instead of throwing for a zero duration', () => {
    const patch = clone();
    patch.durationMs = 0;
    const result = tryRender(patch, 44100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.path === 'durationMs')).toBe(true);
  });

  test('returns issues instead of throwing for a cutoff above Nyquist', () => {
    const patch = clone();
    patch.layers[0].filter = { kind: 'lowpass', hz: 40000 };
    expect(() => tryRender(patch, 44100)).not.toThrow();
    expect(tryRender(patch, 44100).ok).toBe(false);
  });
});

describe('formatIssues', () => {
  test('lists each issue with its path', () => {
    const text = formatIssues([
      { path: 'durationMs', message: 'durationMs must be a number > 0' },
      { path: 'seed', message: 'seed must be a finite number' },
    ]);
    expect(text).toContain('durationMs: durationMs must be a number > 0');
    expect(text).toContain('seed: seed must be a finite number');
  });
});

describe('ViewMemory', () => {
  const view = (tag: string) => ({ samples: new Float32Array(1), stats: tag, typescript: `export const ${tag}` });

  test('has nothing for a cue that never rendered', () => {
    expect(new ViewMemory().forCue('a')).toBeNull();
  });

  test('never returns one cue\'s view for another cue', () => {
    const memory = new ViewMemory();
    memory.remember('b', view('b'));
    expect(memory.forCue('a')).toBeNull();
    expect(memory.forCue('b')?.typescript).toBe('export const b');
  });

  test('A invalid, switch to B, back to A: A shows its own last view, not B', () => {
    const memory = new ViewMemory();
    memory.remember('a', view('a'));
    memory.remember('b', view('b'));
    expect(memory.forCue('a')?.stats).toBe('a');
  });

  test('a newer render replaces the older one for the same cue', () => {
    const memory = new ViewMemory();
    memory.remember('a', view('old'));
    memory.remember('a', view('new'));
    expect(memory.forCue('a')?.stats).toBe('new');
  });
});

describe('sliderLabel', () => {
  test('keeps the layer index so layers can be told apart', () => {
    const a = sliderLabel('layers[0].source.carrierHz', 440);
    const b = sliderLabel('layers[3].source.carrierHz', 440);
    expect(a).not.toBe(b);
    expect(a).toContain('layers[0].source.carrierHz');
    expect(a).toContain('440');
  });
});
