import { describe, expect, test } from 'vitest';
import { createHaptics } from '../src/infrastructure/haptics.ts';
import type { HapticsDriver } from '../src/infrastructure/haptics.ts';
import { HAPTIC_CUES, playCue } from '../src/presentation/feedback/hapticCues.ts';

function fakeDriver(fail: 'none' | 'throw' | 'reject' = 'none') {
  const calls: string[] = [];
  const driver: HapticsDriver = {
    impact: (style) => {
      calls.push(`impact:${style}`);
      if (fail === 'throw') throw new Error('boom');
      return fail === 'reject' ? Promise.reject(new Error('no')) : Promise.resolve();
    },
    notification: (kind) => {
      calls.push(`notify:${kind}`);
      return Promise.resolve();
    },
  };
  return { driver, calls };
}

describe('HapticsPort', () => {
  test('gọi driver khi bật', () => {
    const { driver, calls } = fakeDriver();
    const port = createHaptics(driver, () => true);
    port.impact('medium');
    port.notify('success');
    expect(calls).toEqual(['impact:medium', 'notify:success']);
  });

  test('tắt thì không gọi lần nào', () => {
    const { driver, calls } = fakeDriver();
    const port = createHaptics(driver, () => false);
    port.impact('light');
    port.notify('warning');
    expect(calls).toEqual([]);
  });

  test('không có driver (web) thì không làm gì', () => {
    expect(() => createHaptics(null, () => true).impact('heavy')).not.toThrow();
  });

  test('driver ném lỗi hoặc reject thì lỗi bị nuốt', async () => {
    expect(() => createHaptics(fakeDriver('throw').driver, () => true).impact('light')).not.toThrow();
    createHaptics(fakeDriver('reject').driver, () => true).impact('light');
    await new Promise((r) => setTimeout(r, 0)); // không có unhandled rejection làm vỡ test
  });
});

describe('bảng rung theo sự kiện (spec F2 mục 3)', () => {
  test('ánh xạ đúng', () => {
    expect(HAPTIC_CUES).toEqual({
      lift: { kind: 'impact', style: 'light' },
      snap: { kind: 'impact', style: 'medium' },
      'settle-temporary': { kind: 'impact', style: 'light' },
      rotate: { kind: 'impact', style: 'light' },
      'rotate-blocked': { kind: 'notify', type: 'warning' },
      reset: { kind: 'impact', style: 'light' },
    });
  });

  test('playCue chuyển đúng lời gọi', () => {
    const { driver, calls } = fakeDriver();
    const port = createHaptics(driver, () => true);
    playCue(port, HAPTIC_CUES['rotate-blocked']);
    playCue(port, undefined);
    expect(calls).toEqual(['notify:warning']);
  });
});
