import { describe, expect, test } from 'vitest';
import { LevelTracker } from '../src/application/levelTracker.ts';
import type { AnalyticsPort } from '../src/application/platformPort.ts';
import type { TelemetryEvent } from '../src/application/telemetry.ts';

function setup() {
  const events: TelemetryEvent[] = [];
  const analytics: AnalyticsPort = { track: (event) => void events.push(event), flush: () => {} };
  let t = 1000;
  const tracker = new LevelTracker(analytics, () => t);
  return {
    events,
    tracker,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('LevelTracker', () => {
  test('start phát level_start kèm chương suy từ mã màn và chế độ', () => {
    const { events, tracker } = setup();
    tracker.start('3-4', 'campaign');
    expect(events).toEqual([{ type: 'level_start', levelId: '3-4', chapter: 3, mode: 'campaign', timestamp: 1000 }]);
  });

  test('chương truyền vào tường minh được ưu tiên hơn chương suy từ mã màn', () => {
    const { events, tracker } = setup();
    tracker.start('endless-1-7', 'endless', 1);
    tracker.completed({ elapsedMs: 1000, stars: 3 });
    expect(events[0]).toMatchObject({ levelId: 'endless-1-7', chapter: 1, mode: 'endless' });
    expect(events[1]).toMatchObject({ type: 'level_complete', chapter: 1 });
  });

  test('mã màn không theo dạng chương-số thì chương là 0', () => {
    const { events, tracker } = setup();
    tracker.start('endless-12', 'endless');
    expect(events[0]).toMatchObject({ type: 'level_start', chapter: 0, mode: 'endless' });
  });

  test('kéo, xoay, reset chỉ đếm trong bộ nhớ, không phát sự kiện', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.moved();
    tracker.moved();
    tracker.rotated();
    tracker.reset();
    expect(events).toHaveLength(1);
  });

  test('completed phát level_complete kèm số đếm, thời gian và sao', () => {
    const { events, tracker, advance } = setup();
    tracker.start('1-2', 'campaign');
    tracker.moved();
    tracker.moved();
    tracker.reset();
    advance(5000);
    tracker.completed({ elapsedMs: 4200, stars: 2 });
    expect(events[1]).toEqual({
      type: 'level_complete',
      levelId: '1-2',
      chapter: 1,
      mode: 'campaign',
      elapsedMs: 4200,
      stars: 2,
      resetCount: 1,
      moveCount: 2,
      rotateCount: 0,
      timestamp: 6000,
    });
  });

  test('leave giữa chừng phát level_abandon với thời gian đo từ lúc start', () => {
    const { events, tracker, advance } = setup();
    tracker.start('2-5', 'campaign');
    tracker.moved();
    tracker.rotated();
    tracker.reset();
    tracker.reset();
    advance(42_000);
    tracker.leave('back');
    expect(events[1]).toEqual({
      type: 'level_abandon',
      levelId: '2-5',
      chapter: 2,
      mode: 'campaign',
      elapsedMs: 42_000,
      resetCount: 2,
      moveCount: 1,
      rotateCount: 1,
      reason: 'back',
      timestamp: 43_000,
    });
  });

  test('leave gọi nhiều lần chỉ phát một sự kiện kết thúc', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.leave('level-select');
    tracker.leave('shutdown');
    expect(events.filter((e) => e.type === 'level_abandon')).toHaveLength(1);
  });

  test('thắng rồi rời đi thì không phát abandon', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.completed({ elapsedMs: 3000, stars: 3 });
    tracker.leave('shutdown');
    expect(events.map((e) => e.type)).toEqual(['level_start', 'level_complete']);
  });

  test('completed gọi hai lần chỉ phát một level_complete', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.completed({ elapsedMs: 3000, stars: 3 });
    tracker.completed({ elapsedMs: 3100, stars: 3 });
    expect(events.filter((e) => e.type === 'level_complete')).toHaveLength(1);
  });

  test('start khi lượt cũ chưa kết thúc thì đóng lượt cũ là abandon rồi mở lượt mới', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.start('1-2', 'campaign');
    expect(events.map((e) => `${e.type}:${'levelId' in e ? e.levelId : ''}`)).toEqual([
      'level_start:1-1',
      'level_abandon:1-1',
      'level_start:1-2',
    ]);
    expect(events[1]).toMatchObject({ reason: 'restart-level' });
  });

  test('bộ đếm của lượt cũ không rò sang lượt mới', () => {
    const { events, tracker } = setup();
    tracker.start('1-1', 'campaign');
    tracker.moved();
    tracker.reset();
    tracker.completed({ elapsedMs: 1000, stars: 1 });
    tracker.start('1-2', 'campaign');
    tracker.completed({ elapsedMs: 1000, stars: 1 });
    const last = events[events.length - 1];
    expect(last).toMatchObject({ type: 'level_complete', levelId: '1-2', moveCount: 0, resetCount: 0 });
  });

  test('chưa start thì moved, reset, completed, leave không làm gì và không ném lỗi', () => {
    const { events, tracker } = setup();
    expect(() => {
      tracker.moved();
      tracker.rotated();
      tracker.reset();
      tracker.completed({ elapsedMs: 1, stars: 0 });
      tracker.leave('back');
    }).not.toThrow();
    expect(events).toEqual([]);
  });
});

describe('LevelTracker gắn ngữ cảnh cho crash reporter', () => {
  test('start đặt tag level/chapter/mode và để lại breadcrumb', () => {
    const calls: string[] = [];
    const analytics: AnalyticsPort = { track() {}, flush() {} };
    const crash = {
      capture() {},
      breadcrumb: (m: string) => void calls.push(`crumb:${m}`),
      setContext: (k: string, v: string | number | boolean) => void calls.push(`${k}=${v}`),
    };
    new LevelTracker(analytics, () => 0, crash).start('2-18', 'campaign');
    expect(calls).toEqual(['level=2-18', 'chapter=2', 'mode=campaign', 'crumb:level_start 2-18']);
  });
});
