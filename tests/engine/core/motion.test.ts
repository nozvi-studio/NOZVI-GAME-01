import { afterEach, describe, expect, test } from 'vitest';
import {
  EASES,
  getMotionScale,
  isReducedMotion,
  scaleTiming,
  setMotionScale,
  stagger,
} from '../../../src/engine/core/transitions/motion.ts';

afterEach(() => setMotionScale(1));

describe('core easing', () => {
  test.each(Object.keys(EASES) as Array<keyof typeof EASES>)('%s runs from 0 to 1', (name) => {
    expect(EASES[name](0)).toBeCloseTo(0, 9);
    expect(EASES[name](1)).toBeCloseTo(1, 9);
  });

  test('backOut overshoots before settling', () => {
    expect(Math.max(...[0.6, 0.7, 0.8].map(EASES.backOut))).toBeGreaterThan(1);
  });

  test('the token-driven ease is not in core', () => {
    expect('anticipateOut' in EASES).toBe(false);
  });
});

describe('motion scale', () => {
  test('setMotionScale snaps to 0 or 1', () => {
    setMotionScale(0.4);
    expect(getMotionScale()).toBe(1);
    setMotionScale(0);
    expect(getMotionScale()).toBe(0);
    expect(isReducedMotion()).toBe(true);
    setMotionScale(-3);
    expect(getMotionScale()).toBe(0);
  });

  test('scaleTiming keeps a duration, or zeroes it when reduced', () => {
    expect(scaleTiming(300)).toBe(300);
    setMotionScale(0);
    expect(scaleTiming(300)).toBe(0);
  });
});

describe('stagger', () => {
  test('spreads members evenly over the span', () => {
    expect([0, 1, 2].map((i) => stagger(i, 3, 100))).toEqual([0, 50, 100]);
  });

  test('a single member, or no span, has no delay', () => {
    expect(stagger(0, 1, 100)).toBe(0);
    expect(stagger(2, 3, 0)).toBe(0);
  });
});
