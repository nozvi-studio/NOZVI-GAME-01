import { describe, expect, test } from 'vitest';
import { createGameAnalyticsDriver } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { GameAnalyticsLike } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { TelemetryEvent } from '../src/application/telemetry.ts';

const CONFIG = { gameKey: 'gk', secretKey: 'sk', build: '1.0.0' };

function fakeSdk() {
  const calls: unknown[][] = [];
  const sdk: GameAnalyticsLike = {
    configureBuild: (...a) => void calls.push(['configureBuild', ...a]),
    initialize: (...a) => void calls.push(['initialize', ...a]),
    isReady: () => true,
    addProgressionEvent: (...a) => void calls.push(['progression', ...a]),
    addDesignEvent: (...a) => void calls.push(['design', ...a]),
  };
  return { sdk, calls };
}

const START: TelemetryEvent = { type: 'level_start', levelId: '1-3', chapter: 1, mode: 'campaign', timestamp: 1 };
const COMPLETE: TelemetryEvent = {
  type: 'level_complete', levelId: '1-3', chapter: 1, mode: 'campaign',
  elapsedMs: 8400, stars: 2, resetCount: 1, moveCount: 5, rotateCount: 0, timestamp: 2,
};
const ABANDON: TelemetryEvent = {
  type: 'level_abandon', levelId: 'endless-1-7', chapter: 1, mode: 'endless',
  elapsedMs: 42000, resetCount: 3, moveCount: 8, rotateCount: 1, reason: 'level-select', timestamp: 3,
};

describe('gameAnalyticsDriver', () => {
  test('chờ SDK sẵn sàng rồi mới gửi sự kiện', async () => {
    const { sdk, calls } = fakeSdk();
    let sleeps = 0;
    sdk.isReady = () => sleeps >= 3;
    sdk.addProgressionEvent = (...a) => void calls.push(['progression', sleeps, ...a]);
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true, {
      readyPollMs: 200,
      readyTimeoutMs: 10_000,
      sleep: async () => void (sleeps += 1),
    });
    await driver.track(START);
    const sent = calls.find((c) => c[0] === 'progression') as unknown[];
    expect(sent[1]).toBeGreaterThanOrEqual(3);
    expect(sent.slice(2)).toEqual(['Start', 'chapter1', '1-3']);
  });

  test('quá hạn mà SDK chưa sẵn sàng thì bỏ sự kiện và không ném lỗi', async () => {
    const { sdk, calls } = fakeSdk();
    sdk.isReady = () => false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true, {
      readyPollMs: 200,
      readyTimeoutMs: 1000,
      sleep: async () => {},
    });
    await expect(driver.track(START)).resolves.toBeUndefined();
    expect(calls.some((c) => c[0] === 'progression' || c[0] === 'design')).toBe(false);
  });

  test('warmUp khởi tạo SDK ngay khi đã đồng ý mà không gửi sự kiện nào', async () => {
    const { sdk, calls } = fakeSdk();
    const initialized = new Promise<void>((resolve) => {
      sdk.initialize = (...a) => {
        calls.push(['initialize', ...a]);
        resolve();
      };
    });
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true, { sleep: async () => {} });
    driver.warmUp();
    await initialized;
    expect(calls).toEqual([['configureBuild', '1.0.0'], ['initialize', 'gk', 'sk']]);
    await driver.track(START);
    expect(calls.slice(0, 2)).toEqual([['configureBuild', '1.0.0'], ['initialize', 'gk', 'sk']]);
    expect(calls.filter((c) => c[0] === 'initialize')).toHaveLength(1);
  });

  test('warmUp khi chưa đồng ý thì không nạp SDK', async () => {
    let loaded = false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return fakeSdk().sdk;
    }, () => false);
    driver.warmUp();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loaded).toBe(false);
  });

  test('level_start gửi progression Start theo chương và mã màn', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(START);
    expect(calls).toContainEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('level_complete gửi progression Complete kèm số sao và design event số đếm', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(COMPLETE);
    expect(calls).toContainEqual(['progression', 'Complete', 'chapter1', '1-3', undefined, 2]);
    expect(calls).toContainEqual(['design', 'Complete:Moves:1-3', 5]);
    expect(calls).toContainEqual(['design', 'Complete:Resets:1-3', 1]);
  });

  test('level_abandon gửi progression Fail và design event Abandon', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(ABANDON);
    expect(calls).toContainEqual(['progression', 'Fail', 'chapter1', 'endless-1-7']);
    expect(calls).toContainEqual(['design', 'Abandon:endless-1-7', 3]);
  });

  test('mỗi đoạn của design event không vượt 32 ký tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track({ ...ABANDON, levelId: 'endless-1-' + '9'.repeat(40) });
    const design = calls.find((c) => c[0] === 'design') as [string, string, number];
    for (const segment of design[1].split(':')) expect(segment.length).toBeLessThanOrEqual(32);
  });

  test('chưa đồng ý thì không nạp SDK và không gửi gì', async () => {
    let loaded = false;
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return sdk;
    }, () => false);
    await driver.track(START);
    expect(loaded).toBe(false);
    expect(calls).toEqual([]);
  });

  test('đồng ý thì cấu hình build, khởi tạo đúng một lần rồi gửi theo thứ tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(START);
    await driver.track(COMPLETE);
    const names = calls.map((c) => c[0]);
    expect(names.filter((n) => n === 'initialize')).toHaveLength(1);
    expect(calls[0]).toEqual(['configureBuild', '1.0.0']);
    expect(calls[1]).toEqual(['initialize', 'gk', 'sk']);
    expect(calls[2]).toEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('loại sự kiện không theo dõi thì bị bỏ và không nạp SDK', async () => {
    let loaded = false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return fakeSdk().sdk;
    }, () => true);
    await driver.track({ type: 'piece_rotate', levelId: '1-1', pieceId: 'a', timestamp: 1 });
    expect(loaded).toBe(false);
  });

  test('nạp SDK hỏng thì không ném lỗi', async () => {
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      throw new Error('blocked');
    }, () => true);
    await expect(driver.track(START)).resolves.toBeUndefined();
  });

  test('một lệnh SDK ném lỗi không chặn các lệnh sau và không ném ra ngoài', async () => {
    const { sdk, calls } = fakeSdk();
    sdk.addDesignEvent = () => {
      throw new Error('boom');
    };
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await expect(driver.track(COMPLETE)).resolves.toBeUndefined();
    expect(calls.some((c) => c[0] === 'progression')).toBe(true);
  });
});
