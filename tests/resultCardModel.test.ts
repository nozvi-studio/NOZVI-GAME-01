import { describe, expect, test } from 'vitest';
import { formatClock, resultCardModel, restoredCardModel } from '../src/presentation/hud/resultCardModel.ts';
import type { ResultRecord } from '../src/application/progressPort.ts';

const load = {} as ResultRecord['load'];
const rec = (over: Partial<ResultRecord>): ResultRecord => ({
  previous: null,
  current: { stars: 2, bestMs: 9000 },
  improved: true,
  load,
  ...over,
});

describe('formatClock', () => {
  test.each([[0, '0:00'], [38_999, '0:38'], [60_000, '1:00'], [125_400, '2:05']])('%i -> %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe('resultCardModel', () => {
  test('first clear hides Best', () => {
    const m = resultCardModel({ elapsedMs: 9000, stars: 2, record: rec({ previous: null }) });
    expect(m.best).toBeNull();
    expect(m.timeText).toBe('0:09');
    expect(m.stars).toBe(2);
  });
  test('a new record highlights Best with the new time', () => {
    const m = resultCardModel({
      elapsedMs: 7000,
      stars: 2,
      record: rec({ previous: { stars: 2, bestMs: 9000 }, current: { stars: 2, bestMs: 7000 }, improved: true }),
    });
    expect(m.best).toEqual({ text: '0:07', highlight: true });
  });
  test('a slower run shows the old best without highlight', () => {
    const m = resultCardModel({
      elapsedMs: 12_000,
      stars: 1,
      record: rec({ previous: { stars: 2, bestMs: 9000 }, current: { stars: 2, bestMs: 9000 }, improved: false }),
    });
    expect(m.best).toEqual({ text: '0:09', highlight: false });
    expect(m.stars).toBe(1);
  });
});

describe('restoredCardModel', () => {
  test('shows saved stars and best time, no Best pill', () => {
    expect(restoredCardModel({ stars: 3, bestMs: 5000 })).toEqual({ stars: 3, timeText: '0:05', best: null });
  });
  test('no saved result falls back to dashes', () => {
    expect(restoredCardModel(undefined)).toEqual({ stars: 0, timeText: '-:--', best: null });
  });
});
