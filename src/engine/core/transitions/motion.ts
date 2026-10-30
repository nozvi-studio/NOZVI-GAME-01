export type EaseName = 'linear' | 'cubicOut' | 'cubicInOut' | 'quartOut' | 'backOut' | 'sineInOut';

/** Hàm easing thuần, t trong [0, 1]. Tự viết để test được mà không cần Phaser. */
export const EASES: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  quartOut: (t) => 1 - (1 - t) ** 4,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Độ trễ so le của phần tử thứ `index` trong `count` phần tử, trải đều trên `spanMs`. */
export function stagger(index: number, count: number, spanMs: number): number {
  if (count <= 1 || spanMs <= 0) return 0;
  const i = Math.min(Math.max(index, 0), count - 1);
  return (i * spanMs) / (count - 1);
}

let motionScale = 1;

/** 1 là chuyển động đầy đủ, 0 là Giảm chuyển động. Không có mức giữa. */
export function getMotionScale(): number {
  return motionScale;
}

export function setMotionScale(value: number): void {
  motionScale = value <= 0 ? 0 : 1;
}

export function isReducedMotion(scale: number = motionScale): boolean {
  return scale <= 0;
}

/** Thời lượng chuyển động dịch vị trí: giữ nguyên, hoặc 0 khi Giảm chuyển động. */
export function scaleTiming(ms: number, scale: number = motionScale): number {
  return isReducedMotion(scale) ? 0 : ms;
}
