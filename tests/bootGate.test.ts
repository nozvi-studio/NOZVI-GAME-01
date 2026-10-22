import { describe, expect, it, vi } from 'vitest';
import { createBootGate } from '../src/boot/bootGate';

describe('createBootGate', () => {
  it('coalesces concurrent enterLoading calls and defers loadGame until afterPaint', async () => {
    const showLoading = vi.fn();
    let resolvePaint!: () => void;
    const afterPaint = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolvePaint = resolve;
      });
    });
    const loadGame = vi.fn().mockResolvedValue(undefined);
    const showError = vi.fn();

    const gate = createBootGate({
      showLoading,
      afterPaint,
      loadGame,
      showError,
    });

    // Simulate tap and timeout firing at the same time
    const p1 = gate.enterLoading();
    const p2 = gate.enterLoading();

    expect(showLoading).toHaveBeenCalledTimes(1);
    expect(afterPaint).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledTimes(0);

    // Now let afterPaint resolve
    resolvePaint();
    await Promise.all([p1, p2]);

    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it('handles loadGame rejection with showError and allows retry without showLoading', async () => {
    const showLoading = vi.fn();
    const afterPaint = vi.fn().mockResolvedValue(undefined);
    const loadError = new Error('Chunk load failed');
    const loadGame = vi
      .fn()
      .mockRejectedValueOnce(loadError)
      .mockResolvedValueOnce(undefined);
    const showError = vi.fn();

    const gate = createBootGate({
      showLoading,
      afterPaint,
      loadGame,
      showError,
    });

    await gate.enterLoading();

    expect(showLoading).toHaveBeenCalledTimes(1);
    expect(afterPaint).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledTimes(1);

    const [receivedError, retryFn] = showError.mock.calls[0];
    expect(receivedError).toBe(loadError);
    expect(typeof retryFn).toBe('function');

    // Calling retry fn should re-attempt loadGame without calling showLoading or afterPaint again
    await retryFn();

    expect(showLoading).toHaveBeenCalledTimes(1);
    expect(afterPaint).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledTimes(2);
  });

  it('ignores late enterLoading calls after loadGame has succeeded', async () => {
    const showLoading = vi.fn();
    const afterPaint = vi.fn().mockResolvedValue(undefined);
    const loadGame = vi.fn().mockResolvedValue(undefined);
    const showError = vi.fn();

    const gate = createBootGate({
      showLoading,
      afterPaint,
      loadGame,
      showError,
    });

    await gate.enterLoading();
    expect(loadGame).toHaveBeenCalledTimes(1);

    // Late timer or background resume
    await gate.enterLoading();
    expect(showLoading).toHaveBeenCalledTimes(1);
    expect(afterPaint).toHaveBeenCalledTimes(1);
    expect(loadGame).toHaveBeenCalledTimes(1);
  });
});
