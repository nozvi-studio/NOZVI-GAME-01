import type { EaseName } from './motion.ts';
import { stagger } from './motion.ts';
import type { TransitionTimeline } from './TransitionTimeline.ts';

/** Mọi GameObject của Phaser đều thoả kiểu này (Transform + Alpha). */
export type Poseable = { x: number; y: number; alpha: number; scaleX: number; scaleY: number };

export type PoseDelta = { dx?: number; dy?: number; alpha?: number; scale?: number };

export type Step = {
  part: string;
  atMs: number;
  durationMs: number;
  delta: PoseDelta;
  ease?: EaseName;
  /** Trải các phần tử của part trên khoảng này (so le đều) */
  spanMs?: number;
};

export type Parts = Record<string, readonly Poseable[]>;

/**
 * Đưa phần tử VÀO: ghi lại tư thế tự nhiên, đặt ngay tư thế lệch, rồi tween
 * về tư thế tự nhiên. Vì đích luôn là tư thế lúc dựng cảnh, trạng thái cuối
 * sau khi bỏ qua trùng với cảnh dựng không có animation.
 */
export function enter(
  tl: TransitionTimeline,
  target: Poseable,
  atMs: number,
  durationMs: number,
  from: PoseDelta,
  ease: EaseName = 'cubicOut'
): void {
  const natural = {
    x: target.x,
    y: target.y,
    alpha: target.alpha,
    scaleX: target.scaleX,
    scaleY: target.scaleY,
  };
  target.x = natural.x + (from.dx ?? 0);
  target.y = natural.y + (from.dy ?? 0);
  if (from.alpha !== undefined) target.alpha = from.alpha;
  if (from.scale !== undefined) {
    target.scaleX = natural.scaleX * from.scale;
    target.scaleY = natural.scaleY * from.scale;
  }
  tl.at(atMs, target, natural, durationMs, ease);
}

/** Đưa phần tử RA: tween từ tư thế hiện tại tới tư thế lệch. */
export function exit(
  tl: TransitionTimeline,
  target: Poseable,
  atMs: number,
  durationMs: number,
  to: PoseDelta,
  ease: EaseName = 'cubicOut'
): void {
  const props: Record<string, number> = {};
  if (to.dx !== undefined) props.x = target.x + to.dx;
  if (to.dy !== undefined) props.y = target.y + to.dy;
  if (to.alpha !== undefined) props.alpha = to.alpha;
  if (to.scale !== undefined) {
    props.scaleX = target.scaleX * to.scale;
    props.scaleY = target.scaleY * to.scale;
  }
  tl.at(atMs, target, props, durationMs, ease);
}

export function applySteps(
  tl: TransitionTimeline,
  steps: readonly Step[],
  parts: Parts,
  mode: 'enter' | 'exit'
): void {
  const move = mode === 'enter' ? enter : exit;
  for (const step of steps) {
    const targets = parts[step.part] ?? [];
    targets.forEach((target, i) => {
      const at = step.atMs + stagger(i, targets.length, step.spanMs ?? 0);
      move(tl, target, at, step.durationMs, step.delta, step.ease ?? 'cubicOut');
    });
  }
}

export function stepsEndMs(steps: readonly Step[]): number {
  return steps.reduce((end, s) => Math.max(end, s.atMs + (s.spanMs ?? 0) + s.durationMs), 0);
}

/** Thứ tự bật/tắt node: gần node mốc trước, lan ra hai phía. */
export function orderByDistance<T>(items: readonly T[], anchor: number): T[] {
  return items
    .map((item, i) => ({ item, i, d: Math.abs(i - anchor) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((entry) => entry.item);
}
