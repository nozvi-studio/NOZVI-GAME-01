import type { EaseName } from './motion.ts';
import { EASES } from './motion.ts';

type NumericProps = Record<string, number>;

type TweenEntry = {
  kind: 'tween';
  atMs: number;
  order: number;
  durationMs: number;
  target: NumericProps;
  to: NumericProps;
  from: NumericProps | null;
  ease: (t: number) => number;
  onUpdate?: () => void;
  done: boolean;
};

type CallEntry = { kind: 'call'; atMs: number; order: number; fn: () => void; done: boolean };

/**
 * Bộ lập lịch của một nửa chuyển cảnh. Tự giữ đồng hồ (SceneDirector gọi
 * `advance` mỗi khung hình), không dùng tween của Phaser, nên `complete()` đưa
 * mọi thứ về trạng thái cuối ngay trong cùng khung hình và test được bằng
 * vitest.
 */
export class TransitionTimeline {
  private readonly originMs: number;
  private readonly entries: Array<TweenEntry | CallEntry> = [];
  private doneCallbacks: Array<() => void> = [];
  private elapsedMs = 0;
  private finished = false;
  private counter = 0;

  constructor(originMs = 0) {
    this.originMs = originMs;
  }

  /** Mốc `ms` tính từ đầu tuyến; timeline trừ đi `originMs` của riêng nó. */
  at(
    ms: number,
    target: object,
    to: NumericProps,
    durationMs: number,
    ease: EaseName = 'cubicOut',
    onUpdate?: () => void
  ): this {
    this.entries.push({
      kind: 'tween',
      atMs: Math.max(0, ms - this.originMs),
      order: this.counter++,
      durationMs: Math.max(0, durationMs),
      target: target as NumericProps,
      to,
      from: null,
      ease: EASES[ease],
      onUpdate,
      done: false,
    });
    return this;
  }

  call(ms: number, fn: () => void): this {
    this.entries.push({
      kind: 'call',
      atMs: Math.max(0, ms - this.originMs),
      order: this.counter++,
      fn,
      done: false,
    });
    return this;
  }

  onDone(fn: () => void): this {
    if (this.finished) fn();
    else this.doneCallbacks.push(fn);
    return this;
  }

  get durationMs(): number {
    let end = 0;
    for (const e of this.entries) {
      end = Math.max(end, e.atMs + (e.kind === 'tween' ? e.durationMs : 0));
    }
    return end;
  }

  isFinished(): boolean {
    return this.finished;
  }

  advance(dtMs: number): void {
    if (this.finished) return;
    this.elapsedMs += dtMs;
    this.process(this.elapsedMs);
    if (this.elapsedMs >= this.durationMs) this.finish();
  }

  complete(): void {
    if (this.finished) return;
    this.process(Number.POSITIVE_INFINITY);
    this.finish();
  }

  private process(now: number): void {
    const sorted = [...this.entries].sort((a, b) => a.atMs - b.atMs || a.order - b.order);
    for (const e of sorted) {
      if (e.done || now < e.atMs) continue;
      if (e.kind === 'call') {
        e.done = true;
        e.fn();
        continue;
      }
      if (!e.from) {
        const from: NumericProps = {};
        for (const key of Object.keys(e.to)) from[key] = e.target[key];
        e.from = from;
      }
      const t = e.durationMs === 0 ? 1 : Math.min(1, (now - e.atMs) / e.durationMs);
      const k = t >= 1 ? 1 : e.ease(t);
      for (const key of Object.keys(e.to)) {
        e.target[key] = e.from[key] + (e.to[key] - e.from[key]) * k;
      }
      e.onUpdate?.();
      if (t >= 1) e.done = true;
    }
  }

  private finish(): void {
    this.finished = true;
    const callbacks = this.doneCallbacks;
    this.doneCallbacks = [];
    for (const cb of callbacks) cb();
  }
}
