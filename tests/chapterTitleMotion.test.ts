import { describe, expect, it } from 'vitest';
import { TITLE_TIMING, letterEntrance, titleStyle } from '../src/presentation/galaxy/chapterTitleMotion.ts';

describe('titleStyle', () => {
  it('gives each themed chapter its own entrance', () => {
    expect(titleStyle(1)).toBe('rise');
    expect(titleStyle(2)).toBe('cross');
    expect(titleStyle(3)).toBe('wheel');
    expect(titleStyle(4)).toBe('converge');
    expect(titleStyle(5)).toBe('split');
    expect(titleStyle(9)).toBe('rise');
  });
});

describe('letterEntrance', () => {
  it('wheel: letters swing in one after another around a pivot below them', () => {
    const first = letterEntrance('wheel', 0, 9);
    const last = letterEntrance('wheel', 8, 9);
    expect(first.fromAngle).toBeLessThan(0);
    expect(first.pivotY).toBeGreaterThan(0);
    expect(last.delayMs).toBeGreaterThan(first.delayMs);
  });

  it('converge: letters start on their own side, outer ones first, and the middle barely travels', () => {
    const count = 11;
    const left = letterEntrance('converge', 0, count);
    const right = letterEntrance('converge', count - 1, count);
    const middle = letterEntrance('converge', 5, count);
    expect(left.fromX).toBeLessThan(0);
    expect(right.fromX).toBeGreaterThan(0);
    expect(Math.abs(middle.fromX)).toBe(0);
    expect(left.delayMs).toBeLessThan(middle.delayMs);
    expect(left.fromScaleX).toBeGreaterThan(1);
  });

  it('rise: letters drift up in sequence; cross: neighbours enter from opposite sides', () => {
    const first = letterEntrance('rise', 0, 7);
    expect(first.fromY).toBeGreaterThan(0);
    expect(letterEntrance('rise', 6, 7).delayMs).toBeGreaterThan(first.delayMs);
    expect(letterEntrance('cross', 0, 7).fromX).toBeLessThan(0);
    expect(letterEntrance('cross', 1, 7).fromX).toBeGreaterThan(0);
  });

  it('never returns a negative delay and the longest delay fits inside the enter phase', () => {
    for (const style of ['rise', 'cross', 'wheel', 'converge', 'split'] as const) {
      for (const count of [1, 5, 14]) {
        for (let i = 0; i < count; i++) {
          const { delayMs } = letterEntrance(style, i, count);
          expect(delayMs).toBeGreaterThanOrEqual(0);
          expect(delayMs).toBeLessThan(TITLE_TIMING.enterMs);
        }
      }
    }
  });
});
