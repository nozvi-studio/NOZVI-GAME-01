import { describe, expect, test } from 'vitest';
import { FEEDBACK_TOKENS } from '../src/presentation/designTokens.ts';
import {
  IDLE_NUDGE_START,
  nudgeAlpha,
  nudgeOffset,
  stepIdleNudge,
  type IdleNudgeState,
} from '../src/presentation/board/idleNudge.ts';

const N = FEEDBACK_TOKENS.idleNudge;
const quiet = { activity: false, blocked: false };

function run(state: IdleNudgeState, totalMs: number, stepMs = 16): IdleNudgeState {
  let s = state;
  for (let t = 0; t < totalMs; t += stepMs) s = stepIdleNudge(s, stepMs, quiet);
  return s;
}

describe('stepIdleNudge', () => {
  test('chưa tới ngưỡng chờ thì chưa chạy', () => {
    const s = run(IDLE_NUDGE_START, N.waitMs - 100);
    expect(s.active).toBe(false);
  });

  test('qua ngưỡng chờ thì chạy, phase nằm trong [0, 1)', () => {
    const s = run(IDLE_NUDGE_START, N.waitMs + N.beatMs / 2);
    expect(s.active).toBe(true);
    expect(s.phase).toBeGreaterThan(0);
    expect(s.phase).toBeLessThan(1);
  });

  test('hết nhịp thì nghỉ restMs rồi lặp lại', () => {
    const rest = stepIdleNudge({ idleMs: N.waitMs + N.beatMs + 10, active: false, phase: 0, beat: 0 }, 0, quiet);
    expect(rest.active).toBe(false);
    const again = stepIdleNudge(
      { idleMs: N.waitMs + N.beatMs + N.restMs + 100, active: false, phase: 0, beat: 0 },
      0,
      quiet
    );
    expect(again.active).toBe(true);
  });

  test('mỗi nhịp tăng beat một đơn vị để đến lượt mảnh kế tiếp', () => {
    const cycle = N.beatMs + N.restMs;
    const at = (t: number) => stepIdleNudge({ ...IDLE_NUDGE_START, idleMs: N.waitMs + t }, 0, quiet);
    expect(at(100).beat).toBe(0);
    expect(at(cycle + 100).beat).toBe(1);
    expect(at(2 * cycle + 100).beat).toBe(2);
    expect(at(N.beatMs + 10).beat).toBe(0);
  });

  test('có thao tác thì tắt ngay và đặt lại đồng hồ', () => {
    const running = run(IDLE_NUDGE_START, N.waitMs + 300);
    expect(running.active).toBe(true);
    const after = stepIdleNudge(running, 16, { activity: true, blocked: false });
    expect(after).toEqual(IDLE_NUDGE_START);
    expect(run(after, N.waitMs - 100).active).toBe(false);
  });

  test('bị chặn (kéo, thắng, reduced motion) thì không chạy và đồng hồ về 0', () => {
    const running = run(IDLE_NUDGE_START, N.waitMs + 300);
    const blocked = stepIdleNudge(running, 16, { activity: false, blocked: true });
    expect(blocked).toEqual(IDLE_NUDGE_START);
    let s = IDLE_NUDGE_START;
    for (let t = 0; t < N.waitMs * 2; t += 16) s = stepIdleNudge(s, 16, { activity: false, blocked: true });
    expect(s.active).toBe(false);
  });
});

describe('nudgeOffset', () => {
  test('không có nhịp (null) thì không lệch', () => {
    expect(nudgeOffset(null)).toEqual({ x: 0, y: 0, angleDeg: 0 });
  });

  test('đầu và cuối nhịp bằng 0 để vào ra mượt', () => {
    for (const phase of [0, 1]) {
      const o = nudgeOffset(phase);
      expect(Math.abs(o.x)).toBeLessThan(1e-9);
      expect(Math.abs(o.y)).toBeLessThan(1e-9);
      expect(Math.abs(o.angleDeg)).toBeLessThan(1e-9);
    }
  });

  test('biên độ không vượt giới hạn ở mọi phase', () => {
    let peak = 0;
    for (let p = 0; p <= 1; p += 0.01) {
      const o = nudgeOffset(p);
      peak = Math.max(peak, Math.abs(o.angleDeg));
      expect(Math.abs(o.angleDeg)).toBeLessThanOrEqual(N.angleDeg + 1e-9);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(N.px + 1e-9);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(N.px + 1e-9);
    }
    expect(peak).toBeGreaterThan(N.angleDeg * 0.5);
  });
});

describe('nudgeAlpha', () => {
  test('không có nhịp thì hệ số là 1', () => {
    expect(nudgeAlpha(null)).toBe(1);
  });

  test('đầu và cuối nhịp là 1, trong nhịp dao động trong [1 - amp, 1 + amp]', () => {
    expect(nudgeAlpha(0)).toBeCloseTo(1, 9);
    expect(nudgeAlpha(1)).toBeCloseTo(1, 9);
    let min = 1;
    let max = 1;
    for (let p = 0; p <= 1; p += 0.01) {
      const k = nudgeAlpha(p);
      min = Math.min(min, k);
      max = Math.max(max, k);
    }
    expect(min).toBeGreaterThanOrEqual(1 - N.breathAmp - 1e-9);
    expect(max).toBeLessThanOrEqual(1 + N.breathAmp + 1e-9);
    expect(max - min).toBeGreaterThan(0.05);
  });
});
