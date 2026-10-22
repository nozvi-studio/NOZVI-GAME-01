import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createCheckQueue } from '../src/studio/checkQueue.ts';

describe('createCheckQueue (spec E, ST-04, Quyết định 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('debounce 300ms: nhiều yêu cầu liên tiếp chỉ chạy bản cuối', async () => {
    const run = vi.fn().mockResolvedValue('ok');
    const onResult = vi.fn();
    const queue = createCheckQueue({ delayMs: 300, run, onResult });

    queue.enqueue('req-1');
    queue.enqueue('req-2');
    queue.enqueue('req-3');

    expect(run).not.toHaveBeenCalled();

    // Advance 299ms - chưa chạy
    vi.advanceTimersByTime(299);
    expect(run).not.toHaveBeenCalled();

    // Advance 1ms nữa (đủ 300ms) - chạy req-3 với seq 3
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('req-3', 3);

    // Chờ promise hoàn thành
    await Promise.resolve();
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledWith('ok', 3, false);
  });

  test('chỉ một lần giải tại một thời điểm; yêu cầu mới lúc đang giải được giữ lại và chạy tiếp', async () => {
    let resolveRun1!: (val: string) => void;
    const run1Promise = new Promise<string>((r) => {
      resolveRun1 = r;
    });

    const run = vi.fn().mockImplementation((req: string) => {
      if (req === 'req-1') return run1Promise;
      return Promise.resolve(`res-${req}`);
    });

    const onResult = vi.fn();
    const queue = createCheckQueue({ delayMs: 300, run, onResult });

    queue.enqueue('req-1');
    vi.advanceTimersByTime(300);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('req-1', 1);
    expect(queue.isBusy()).toBe(true);

    // Trong khi run 1 đang chạy, gửi req-2 rồi req-3
    queue.enqueue('req-2');
    vi.advanceTimersByTime(300);
    queue.enqueue('req-3');
    vi.advanceTimersByTime(300);

    // Vẫn chỉ có run 1 đang chạy, không chạy song song
    expect(run).toHaveBeenCalledTimes(1);

    // Run 1 hoàn tất
    resolveRun1('res-1');
    await Promise.resolve();
    await Promise.resolve();

    // Kết quả 1 được trả về nhưng là stale vì latestSeq là 3
    expect(onResult).toHaveBeenCalledWith('res-1', 1, true);

    // Queue tự động chạy tiếp bản mới nhất (req-3)
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith('req-3', 3);

    await Promise.resolve();
    await Promise.resolve();
    expect(onResult).toHaveBeenLastCalledWith('res-req-3', 3, false);
    expect(queue.isBusy()).toBe(false);
  });

  test('dispose hủy timer và không chạy nữa', () => {
    const run = vi.fn().mockResolvedValue('ok');
    const onResult = vi.fn();
    const queue = createCheckQueue({ delayMs: 300, run, onResult });

    queue.enqueue('req-1');
    queue.dispose();

    vi.advanceTimersByTime(500);
    expect(run).not.toHaveBeenCalled();
  });
});
