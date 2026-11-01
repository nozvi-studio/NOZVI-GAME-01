import { describe, expect, test, vi } from 'vitest';
import { createGameAnalyticsDriver } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { GameAnalyticsLike } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { TelemetryEvent } from '../src/engine/core/platform/telemetry.ts';
import type { PrivacyState } from '../src/application/privacyChoices.ts';

function fakePrivacy(initial: Partial<PrivacyState> = { analytics: true }) {
  let state: PrivacyState = { analytics: false, diagnostics: false, ...initial };
  let id = 'user-1';
  const listeners = new Set<(s: PrivacyState) => void>();
  return {
    get: () => state,
    userId: () => id,
    onChange: (l: (s: PrivacyState) => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    change(next: Partial<PrivacyState>, newId?: string) {
      state = { ...state, ...next };
      if (newId) id = newId;
      for (const l of listeners) l(state);
    },
  };
}

const CONFIG = { gameKey: 'gk', secretKey: 'sk', build: '1.0.0' };

function fakeSdk() {
  const calls: unknown[][] = [];
  const sdk: GameAnalyticsLike = {
    configureBuild: (...a) => void calls.push(['configureBuild', ...a]),
    configureUserId: (...a) => void calls.push(['configureUserId', ...a]),
    setEnabledEventSubmission: (...a) => void calls.push(['submission', ...a]),
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
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy(), {
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
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy(), {
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
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy(), { sleep: async () => {} });
    driver.warmUp();
    await initialized;
    const INIT = [['configureBuild', '1.0.0'], ['configureUserId', 'user-1'], ['initialize', 'gk', 'sk']];
    expect(calls).toEqual(INIT);
    await driver.track(START);
    expect(calls.slice(0, 3)).toEqual(INIT);
    expect(calls.filter((c) => c[0] === 'initialize')).toHaveLength(1);
  });

  test('warmUp khi chưa đồng ý thì không nạp SDK', async () => {
    let loaded = false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return fakeSdk().sdk;
    }, fakePrivacy({ analytics: false }));
    driver.warmUp();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(loaded).toBe(false);
  });

  test('level_start gửi progression Start theo chương và mã màn', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
    await driver.track(START);
    expect(calls).toContainEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('level_complete gửi progression Complete kèm số sao và design event số đếm', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
    await driver.track(COMPLETE);
    expect(calls).toContainEqual(['progression', 'Complete', 'chapter1', '1-3', undefined, 2]);
    expect(calls).toContainEqual(['design', 'Complete:Moves:1-3', 5]);
    expect(calls).toContainEqual(['design', 'Complete:Resets:1-3', 1]);
  });

  test('level_abandon gửi progression Fail và design event Abandon', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
    await driver.track(ABANDON);
    expect(calls).toContainEqual(['progression', 'Fail', 'chapter1', 'endless-1-7']);
    expect(calls).toContainEqual(['design', 'Abandon:endless-1-7', 3]);
  });

  test('mỗi đoạn của design event không vượt 32 ký tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
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
    }, fakePrivacy({ analytics: false }));
    await driver.track(START);
    expect(loaded).toBe(false);
    expect(calls).toEqual([]);
  });

  test('đồng ý thì cấu hình build, khởi tạo đúng một lần rồi gửi theo thứ tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
    await driver.track(START);
    await driver.track(COMPLETE);
    const names = calls.map((c) => c[0]);
    expect(names.filter((n) => n === 'initialize')).toHaveLength(1);
    expect(calls[0]).toEqual(['configureBuild', '1.0.0']);
    expect(calls[1]).toEqual(['configureUserId', 'user-1']);
    expect(calls[2]).toEqual(['initialize', 'gk', 'sk']);
    expect(calls[3]).toEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('loại sự kiện không theo dõi thì bị bỏ và không nạp SDK', async () => {
    let loaded = false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return fakeSdk().sdk;
    }, fakePrivacy());
    await driver.track({ type: 'piece_rotate', levelId: '1-1', pieceId: 'a', timestamp: 1 });
    expect(loaded).toBe(false);
  });

  test('nạp SDK hỏng thì không ném lỗi', async () => {
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      throw new Error('blocked');
    }, fakePrivacy());
    await expect(driver.track(START)).resolves.toBeUndefined();
  });

  test('một lệnh SDK ném lỗi không chặn các lệnh sau và không ném ra ngoài', async () => {
    const { sdk, calls } = fakeSdk();
    sdk.addDesignEvent = () => {
      throw new Error('boom');
    };
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, fakePrivacy());
    await expect(driver.track(COMPLETE)).resolves.toBeUndefined();
    expect(calls.some((c) => c[0] === 'progression')).toBe(true);
  });
});

describe('gameAnalyticsDriver theo lựa chọn quyền riêng tư', () => {
  const noWait = { readyPollMs: 1, readyTimeoutMs: 10, sleep: async () => {} };

  function storeSpy() {
    const removed: string[] = [];
    return { removed, store: { removeItem: (k: string) => void removed.push(k) } };
  }

  test('tạo driver khi đang tắt thì xóa kho SDK còn sót', () => {
    const s = storeSpy();
    createGameAnalyticsDriver(CONFIG, async () => fakeSdk().sdk, fakePrivacy({ analytics: false }), { ...noWait, store: s.store });
    expect(s.removed).toContain('GA::gk::ga_event');
  });

  test('rút lại sau khi SDK đã chạy: ngừng gửi, xóa kho, sự kiện sau bị bỏ', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy();
    const s = storeSpy();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, p, { ...noWait, store: s.store });
    await driver.track(START);
    p.change({ analytics: false }, 'user-2');
    await Promise.resolve();
    expect(calls).toContainEqual(['submission', false]);
    expect(s.removed).toContain('GA::gk::ga_event');
    const before = calls.length;
    await driver.track(START);
    expect(calls.length).toBe(before);
  });

  test('bật lại trong cùng phiên sau khi đã chạy thì vẫn dừng tới lần mở sau', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, p, noWait);
    await driver.track(START);
    p.change({ analytics: false }, 'user-2');
    p.change({ analytics: true });
    await Promise.resolve();
    const before = calls.length;
    await driver.track(START);
    expect(calls.length).toBe(before);
  });

  test('bật lần đầu trong Settings (SDK chưa chạy) thì khởi tạo với userId hiện tại', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy({ analytics: false });
    createGameAnalyticsDriver(CONFIG, async () => sdk, p, noWait);
    p.change({ analytics: true }, 'user-9');
    await vi.waitFor(() => expect(calls).toContainEqual(['initialize', 'gk', 'sk']));
    expect(calls).toContainEqual(['configureUserId', 'user-9']);
  });
});
