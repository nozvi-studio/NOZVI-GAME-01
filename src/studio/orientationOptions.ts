import type { Orientation, ShapeKind } from '../domain/model.ts';
import { isValidFrame, shapePolygon } from '../domain/shapes.ts';

/** Các cỡ khung chào mời trong palette; lọc lại theo isValidFrame của từng hướng. */
export const CANDIDATE_SIZES: readonly number[] = [
  16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 112, 120, 128,
];

export type OrientationFamily = {
  label: string;
  orientations: readonly Orientation[];
};

const TRIANGLE_FAMILIES: readonly OrientationFamily[] = [
  { label: 'Góc', orientations: [0, 1, 2, 3] },
  { label: 'Mái', orientations: [4, 5, 6, 7] },
];

const PARALLELOGRAM_FAMILIES: readonly OrientationFamily[] = [
  { label: 'Nghiêng', orientations: [0, 1, 2, 3] },
];

/**
 * Các họ hướng của một hình. Tam giác chia hai họ vì xoay 90° không đưa
 * được tam giác vuông thành tam giác cân (xem effectiveOrientation).
 * Hình chỉ có hướng 0 trả về mảng rỗng: palette ẩn hàng chọn hướng.
 */
export function orientationFamilies(kind: ShapeKind): readonly OrientationFamily[] {
  if (kind === 'triangle') return TRIANGLE_FAMILIES;
  if (kind === 'parallelogram') return PARALLELOGRAM_FAMILIES;
  return [];
}

export function validFrameSizes(kind: ShapeKind, orientation: Orientation): number[] {
  return CANDIDATE_SIZES.filter((s) => isValidFrame(kind, orientation, s));
}

/** Cỡ khung còn hợp lệ thì giữ; không thì lấy cỡ hợp lệ đầu tiên. */
export function snapFrameSize(
  kind: ShapeKind,
  orientation: Orientation,
  current: number
): number {
  if (isValidFrame(kind, orientation, current)) return current;
  const valid = validFrameSizes(kind, orientation);
  return valid.length > 0 ? valid[0] : current;
}

/** Thuộc tính `points` của <polygon> cho ảnh xem trước trong hộp boxSize × boxSize. */
export function previewPoints(
  kind: ShapeKind,
  orientation: Orientation,
  boxSize: number
): string {
  return shapePolygon(kind, orientation, boxSize)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');
}
