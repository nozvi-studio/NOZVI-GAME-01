import { describe, expect, test } from 'vitest';
import { FEEDBACK_TOKENS } from '../src/presentation/designTokens.ts';
import { createDoubleTap } from '../src/presentation/board/doubleTap.ts';
import { createHoldRotate } from '../src/presentation/board/holdRotate.ts';

const H = FEEDBACK_TOKENS.holdRotate;
const S = FEEDBACK_TOKENS.doubleTap.slopPx;

describe('createDoubleTap.pending', () => {
  test('true only for the same piece inside the window, and does not consume the tap', () => {
    const tap = createDoubleTap();
    const at = { x: 0, y: 0 };
    tap.register('a', at, at, 1000);
    expect(tap.pending('a', 1100)).toBe(true);
    expect(tap.pending('a', 1100)).toBe(true);
    expect(tap.pending('b', 1100)).toBe(false);
    expect(tap.pending('a', 1000 + FEEDBACK_TOKENS.doubleTap.windowMs + 1)).toBe(false);
  });
});

describe('createHoldRotate', () => {
  test('nothing happens before the hold delay', () => {
    const hold = createHoldRotate();
    hold.begin('a', 10, 10, 1000);
    expect(hold.step(1000 + H.delayMs - 1)).toBe('none');
  });

  test('first turn after the delay, then one turn per step with pauses between', () => {
    const hold = createHoldRotate();
    hold.begin('a', 10, 10, 1000);
    const t0 = 1000 + H.delayMs;
    expect(hold.step(t0)).toBe('start');
    expect(hold.step(t0 + 1)).toBe('none');
    expect(hold.step(t0 + H.stepMs - 1)).toBe('none');
    expect(hold.step(t0 + H.stepMs)).toBe('turn');
    expect(hold.step(t0 + H.stepMs + 5)).toBe('none');
    expect(hold.step(t0 + 2 * H.stepMs)).toBe('turn');
  });

  test('moving farther than the slop before it starts turns it into a drag', () => {
    const hold = createHoldRotate();
    hold.begin('a', 10, 10, 1000);
    hold.move(10 + S + 1, 10);
    expect(hold.step(1000 + H.delayMs + 50)).toBe('none');
    expect(hold.end()).toBe(false);
  });

  test('small jitter does not cancel, and movement after it started is ignored', () => {
    const hold = createHoldRotate();
    hold.begin('a', 10, 10, 1000);
    hold.move(10 + S - 1, 10);
    expect(hold.step(1000 + H.delayMs)).toBe('start');
    hold.move(500, 500);
    expect(hold.step(1000 + H.delayMs + H.stepMs)).toBe('turn');
  });

  test('end reports whether it was turning, and stops further turns', () => {
    const hold = createHoldRotate();
    hold.begin('a', 0, 0, 1000);
    expect(hold.end()).toBe(false);
    hold.begin('a', 0, 0, 2000);
    hold.step(2000 + H.delayMs);
    expect(hold.end()).toBe(true);
    expect(hold.step(2000 + 5 * H.stepMs)).toBe('none');
  });

  test('cancel drops a pending hold', () => {
    const hold = createHoldRotate();
    hold.begin('a', 0, 0, 1000);
    hold.cancel();
    expect(hold.step(1000 + H.delayMs)).toBe('none');
    expect(hold.end()).toBe(false);
  });
});
