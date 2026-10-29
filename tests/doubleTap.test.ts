import { describe, expect, test } from 'vitest';
import { FEEDBACK_TOKENS } from '../src/presentation/designTokens.ts';
import { createDoubleTap } from '../src/presentation/board/doubleTap.ts';

const D = FEEDBACK_TOKENS.doubleTap;

describe('createDoubleTap', () => {
  test('hai lần chạm nhanh cùng một mảnh, tại chỗ thì là double tap', () => {
    const tap = createDoubleTap();
    expect(tap.register('a', { x: 100, y: 100 }, { x: 101, y: 100 }, 1000)).toBe(false);
    expect(tap.register('a', { x: 100, y: 100 }, { x: 100, y: 101 }, 1000 + D.windowMs - 10)).toBe(true);
  });

  test('wouldComplete báo trước register mà không tiêu thụ lần chạm đầu', () => {
    const tap = createDoubleTap();
    const at = { x: 0, y: 0 };
    expect(tap.wouldComplete('a', at, at, 1000)).toBe(false);
    tap.register('a', at, at, 1000);
    expect(tap.wouldComplete('a', at, at, 1100)).toBe(true);
    expect(tap.wouldComplete('a', at, at, 1100)).toBe(true); // peeking twice changes nothing
    expect(tap.wouldComplete('b', at, at, 1100)).toBe(false);
    expect(tap.wouldComplete('a', at, { x: D.slopPx + 5, y: 0 }, 1100)).toBe(false); // a drag
    expect(tap.wouldComplete('a', at, at, 1000 + D.windowMs + 10)).toBe(false);
    expect(tap.register('a', at, at, 1100)).toBe(true); // still there for the real call
  });

  test('quá cửa sổ thời gian thì không tính', () => {
    const tap = createDoubleTap();
    tap.register('a', { x: 0, y: 0 }, { x: 0, y: 0 }, 1000);
    expect(tap.register('a', { x: 0, y: 0 }, { x: 0, y: 0 }, 1000 + D.windowMs + 10)).toBe(false);
  });

  test('khác mảnh hoặc không trúng mảnh nào thì không tính', () => {
    const tap = createDoubleTap();
    tap.register('a', { x: 0, y: 0 }, { x: 0, y: 0 }, 1000);
    expect(tap.register('b', { x: 0, y: 0 }, { x: 0, y: 0 }, 1100)).toBe(false);
    expect(tap.register(null, { x: 0, y: 0 }, { x: 0, y: 0 }, 1200)).toBe(false);
    // the tap on empty space cleared the pending one, so this 'b' only starts a new pair
    expect(tap.register('b', { x: 0, y: 0 }, { x: 0, y: 0 }, 1300)).toBe(false);
    expect(tap.register('b', { x: 0, y: 0 }, { x: 0, y: 0 }, 1400)).toBe(true);
  });

  test('kéo đi xa thì không phải chạm và xoá lần chạm trước', () => {
    const tap = createDoubleTap();
    tap.register('a', { x: 0, y: 0 }, { x: 0, y: 0 }, 1000);
    expect(tap.register('a', { x: 0, y: 0 }, { x: D.slopPx + 5, y: 0 }, 1100)).toBe(false);
    expect(tap.register('a', { x: 0, y: 0 }, { x: 0, y: 0 }, 1200)).toBe(false);
  });

  test('sau một double tap, lần chạm kế tiếp bắt đầu lại từ đầu (không tính ba lần)', () => {
    const tap = createDoubleTap();
    const at = { x: 0, y: 0 };
    tap.register('a', at, at, 1000);
    expect(tap.register('a', at, at, 1100)).toBe(true);
    expect(tap.register('a', at, at, 1200)).toBe(false);
  });

  test('reset xoá lần chạm đang chờ', () => {
    const tap = createDoubleTap();
    const at = { x: 0, y: 0 };
    tap.register('a', at, at, 1000);
    tap.reset();
    expect(tap.register('a', at, at, 1100)).toBe(false);
  });
});
