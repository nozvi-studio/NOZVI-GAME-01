import { describe, expect, test } from 'vitest';
import { TransitionTimeline } from '../src/presentation/transitions/TransitionTimeline.ts';
import {
  applySteps,
  enter,
  exit,
  orderByDistance,
  stepsEndMs,
} from '../src/presentation/transitions/choreography.ts';
import type { Poseable } from '../src/presentation/transitions/choreography.ts';

const pose = (over: Partial<Poseable> = {}): Poseable => ({
  x: 100, y: 200, alpha: 1, scaleX: 1, scaleY: 1, ...over,
});

describe('enter / exit', () => {
  test('enter đặt ngay tư thế lệch, complete trả đúng tư thế tự nhiên', () => {
    const p = pose({ scaleX: 2, scaleY: -0.85 });
    const tl = new TransitionTimeline();
    enter(tl, p, 0, 300, { dy: -40, alpha: 0, scale: 0.5 });
    expect(p).toEqual({ x: 100, y: 160, alpha: 0, scaleX: 1, scaleY: -0.425 });
    tl.complete();
    expect(p).toEqual({ x: 100, y: 200, alpha: 1, scaleX: 2, scaleY: -0.85 });
  });

  test('exit giữ nguyên lúc lên lịch, complete tới tư thế lệch', () => {
    const p = pose();
    const tl = new TransitionTimeline();
    exit(tl, p, 100, 200, { dx: 30, alpha: 0, scale: 0.9 });
    expect(p).toEqual(pose());
    tl.complete();
    expect(p.x).toBe(130);
    expect(p.alpha).toBe(0);
    expect(p.scaleX).toBeCloseTo(0.9, 9);
  });

  test('exit không đụng thuộc tính không có trong delta', () => {
    const p = pose({ alpha: 0.4 });
    const tl = new TransitionTimeline();
    exit(tl, p, 0, 100, { dy: 10 });
    tl.complete();
    expect(p.alpha).toBe(0.4);
    expect(p.y).toBe(210);
  });
});

describe('applySteps', () => {
  test('so le theo spanMs trong một part, part thiếu thì bỏ qua', () => {
    const a = pose();
    const b = pose();
    const tl = new TransitionTimeline();
    applySteps(tl, [
      { part: 'row', atMs: 0, durationMs: 100, delta: { alpha: 0 }, ease: 'linear', spanMs: 100 },
      { part: 'missing', atMs: 0, durationMs: 100, delta: { alpha: 0 } },
    ], { row: [a, b] }, 'exit');
    tl.advance(50);
    expect(a.alpha).toBeCloseTo(0.5, 9);
    expect(b.alpha).toBe(1);
    tl.advance(100);
    expect(a.alpha).toBe(0);
    expect(b.alpha).toBeCloseTo(0.5, 9);
  });

  test('stepsEndMs tính cả span và thời lượng', () => {
    expect(stepsEndMs([
      { part: 'a', atMs: 100, durationMs: 300, delta: {} },
      { part: 'b', atMs: 500, durationMs: 420, delta: {}, spanMs: 80 },
    ])).toBe(1000);
    expect(stepsEndMs([])).toBe(0);
  });
});

describe('orderByDistance', () => {
  test('gần mốc trước, cùng khoảng cách thì giữ thứ tự gốc', () => {
    expect(orderByDistance(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['c', 'b', 'd', 'a', 'e']);
    expect(orderByDistance(['a', 'b'], 0)).toEqual(['a', 'b']);
  });
});
