import { describe, expect, it } from 'vitest';
import { LoadingProgress } from '../../../src/engine/core/boot/loadingProgress.ts';

const OPTIONS = { minMs: 1400, maxMs: 8000 };

function run(progress: LoadingProgress, ms: number, frame = 16) {
  let state = progress.state;
  const percents: number[] = [];
  for (let t = 0; t < ms; t += frame) {
    state = progress.tick(frame);
    percents.push(state.percent);
  }
  return { state, percents };
}

describe('LoadingProgress', () => {
  it('does not finish before the minimum time even when every task is done', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], OPTIONS);
    progress.complete('a');
    const { state } = run(progress, 1350);
    expect(state.done).toBe(false);
    expect(state.percent).toBeLessThan(100);
  });

  it('finishes shortly after the minimum time once every task is done', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], OPTIONS);
    progress.complete('a');
    const { state } = run(progress, 2500);
    expect(state).toEqual({ percent: 100, done: true });
  });

  it('waits for unfinished tasks and tops out near their weighted share', () => {
    const progress = new LoadingProgress(
      [
        { id: 'a', weight: 3 },
        { id: 'b', weight: 1 },
      ],
      OPTIONS
    );
    progress.complete('a');
    const { state } = run(progress, 4000);
    expect(state.done).toBe(false);
    expect(state.percent).toBeGreaterThanOrEqual(70);
    expect(state.percent).toBeLessThanOrEqual(75);
  });

  it('gives up at the maximum time and finishes', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], OPTIONS);
    const { state } = run(progress, 8100);
    expect(state).toEqual({ percent: 100, done: true });
  });

  it('never decreases and never shows 100 before done', () => {
    const progress = new LoadingProgress(
      [
        { id: 'a', weight: 1 },
        { id: 'b', weight: 1 },
      ],
      OPTIONS
    );
    const all: number[] = [];
    for (let step = 0; step < 100; step += 1) {
      if (step === 20) progress.report('a', 0.5);
      if (step === 40) progress.report('a', 1);
      if (step === 60) progress.report('b', 0.3);
      const state = progress.tick(16);
      all.push(state.percent);
      if (!state.done) expect(state.percent).toBeLessThan(100);
    }
    for (let i = 1; i < all.length; i += 1) expect(all[i]).toBeGreaterThanOrEqual(all[i - 1]);
  });

  it('ignores unknown tasks, clamps fractions and never lets a task go backwards', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], { minMs: 1000, maxMs: 8000 });
    progress.report('missing', 1);
    progress.report('a', 0.5);
    progress.report('a', 0.1);
    progress.report('a', -3);
    const { state } = run(progress, 3000);
    expect(state.percent).toBeGreaterThanOrEqual(45);
    expect(state.percent).toBeLessThanOrEqual(50);
  });

  it('treats an empty task list as already complete', () => {
    const progress = new LoadingProgress([], OPTIONS);
    expect(run(progress, 2500).state.done).toBe(true);
  });
});

describe('LoadingProgress pacing', () => {
  const sample = (progress: LoadingProgress, ms: number, before?: (t: number) => void) => {
    const percents: number[] = [];
    for (let t = 0; t < ms; t += 16) {
      before?.(t);
      percents.push(progress.tick(16).percent);
    }
    return percents;
  };
  /** Longest stretch of frames with an unchanged percent, ignoring the very start and the end. */
  const longestFlat = (percents: number[]): number => {
    let best = 0;
    let run = 0;
    for (let i = 1; i < percents.length; i += 1) {
      const inside = percents[i] > 3 && percents[i] < 97;
      run = inside && percents[i] === percents[i - 1] ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  };

  it('runs, hesitates and runs again when everything is already loaded', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], { minMs: 2000, maxMs: 12000 });
    progress.complete('a');
    const percents = sample(progress, 2000);
    // With a 2 s minimum and 120 ms easing, the integer percentage still pauses for ~80 ms.
    expect(longestFlat(percents)).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < percents.length; i += 1) expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
  });

  it('stays below 100 for the whole minimum time and finishes right after it', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], { minMs: 2000, maxMs: 12000 });
    progress.complete('a');
    const during = sample(progress, 1900);
    expect(Math.max(...during)).toBeLessThan(100);
    const after = sample(progress, 1000);
    expect(after[after.length - 1]).toBe(100);
  });

  it('follows real loading without hesitating while it is the slower side', () => {
    const progress = new LoadingProgress([{ id: 'a', weight: 1 }], { minMs: 2000, maxMs: 12000 });
    // A slow asset (9 s): the bar tracks it smoothly instead of stalling on the pacing curve.
    const percents = sample(progress, 3000, (t) => progress.report('a', t / 9000));
    // Integer rounding alone allows a few unchanged frames; a real stall would be 25+.
    expect(longestFlat(percents)).toBeLessThanOrEqual(8);
    const last = percents[percents.length - 1];
    expect(last).toBeGreaterThanOrEqual(28);
    expect(last).toBeLessThanOrEqual(34);
  });

  it('keeps progress below 100 while audio is unsettled and galaxy is pending, but finishes at maxMs fallback', () => {
    // Matches LoadingScene task setup: fonts weight 1, galaxy weight 6, audio weight 2
    const progress = new LoadingProgress(
      [
        { id: 'fonts', weight: 1 },
        { id: 'galaxy', weight: 6 },
        { id: 'audio', weight: 2 },
      ],
      { minMs: 2000, maxMs: 8000 }
    );
    // Fonts are pre-loaded
    progress.complete('fonts');

    // Run past minMs (6000ms total): audio still unsettled and galaxy only reported 50%
    progress.report('galaxy', 0.5);
    const mid = run(progress, 6000);
    expect(mid.state.done).toBe(false);
    expect(mid.state.percent).toBeLessThan(100);

    // Audio settles, but galaxy is still pending at 50%
    progress.complete('audio');
    const mid2 = run(progress, 1000); // 7000ms total
    expect(mid2.state.done).toBe(false);
    expect(mid2.state.percent).toBeLessThan(100);

    // At maxMs (8000ms), max-time fallback triggers and completes even if galaxy is incomplete
    const end = run(progress, 1500); // 8500ms total
    expect(end.state.done).toBe(true);
    expect(end.state.percent).toBe(100);
  });
});
