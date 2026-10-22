import { describe, expect, test } from 'vitest';
import { polygonArea } from '../src/presentation/board/polygonClip.ts';
import {
  EMBLEM_LOOP_MS,
  FROZEN_POSE_MS,
  REST_OFFSET,
  OVERLAP_OFFSET,
  emblemOffsetAt,
  emblemOverlap,
  emblemStarAlpha,
  nextElapsed,
} from '../src/presentation/menu/dualJewelGeometry.ts';

const R = 68;

describe('Hình học vòng lặp XOR của biểu tượng Ngọc Đôi', () => {
  test('lúc nghỉ hai viên tách rời, không có vùng giao', () => {
    const offset = emblemOffsetAt(0);
    expect(offset).toBe(REST_OFFSET);
    expect(polygonArea(emblemOverlap(offset, R))).toBe(0);
  });

  test('tại 3,0s hai viên đã chồng, vùng giao có diện tích thật', () => {
    const offset = emblemOffsetAt(3000);
    expect(offset).toBeLessThan(REST_OFFSET);
    expect(polygonArea(emblemOverlap(offset, R))).toBeGreaterThan(0);
  });

  test('hai viên rời hẳn khi nghỉ: khoảng cách tâm lớn hơn bề rộng một viên', () => {
    // 38 với bán kính 68 khiến hai viên chồng nhau 60px ngay lúc "nghỉ".
    expect(REST_OFFSET).toBeGreaterThan(R);
  });

  test('vùng giao xuất hiện liên tục từ 0, không bật đột ngột', () => {
    // Ngay dưới ngưỡng chạm đỉnh, vùng giao phải còn rất nhỏ. Guard đặc cách
    // theo REST_OFFSET từng làm nó nhảy thẳng từ 0 lên một mảng lớn.
    const justTouching = polygonArea(emblemOverlap(R - 0.5, R));
    const wellInside = polygonArea(emblemOverlap(OVERLAP_OFFSET, R));
    expect(justTouching).toBeGreaterThan(0);
    expect(justTouching).toBeLessThan(wellInside * 0.05);
  });

  test('đúng lúc chạm đỉnh thì chưa có diện tích giao', () => {
    expect(polygonArea(emblemOverlap(R, R))).toBe(0);
  });

  test('vùng giao lớn dần khi hai viên tiến lại gần nhau', () => {
    const far = polygonArea(emblemOverlap(30, R));
    const near = polygonArea(emblemOverlap(OVERLAP_OFFSET, R));
    expect(near).toBeGreaterThan(far);
  });

  test('ngôi sao chỉ sáng sau khi vùng giao đã hình thành', () => {
    expect(emblemStarAlpha(0)).toBe(0);
    expect(emblemStarAlpha(2000)).toBe(0);
    expect(emblemStarAlpha(FROZEN_POSE_MS)).toBeGreaterThan(0.5);
  });

  test('vòng lặp khép kín: đầu và cuối cùng một tư thế', () => {
    expect(emblemOffsetAt(0)).toBeCloseTo(emblemOffsetAt(EMBLEM_LOOP_MS), 5);
  });

  test('tư thế đóng băng của Giảm chuyển động có cả vùng giao lẫn ngôi sao', () => {
    const offset = emblemOffsetAt(FROZEN_POSE_MS);
    expect(polygonArea(emblemOverlap(offset, R))).toBeGreaterThan(0);
    expect(emblemStarAlpha(FROZEN_POSE_MS)).toBeGreaterThan(0.5);
  });

  test('bật Giảm chuyển động thì thời gian không tiến, luôn giữ tư thế đã chồng', () => {
    expect(nextElapsed(0, 16, true)).toBe(FROZEN_POSE_MS);
    expect(nextElapsed(FROZEN_POSE_MS, 16, true)).toBe(FROZEN_POSE_MS);
    // Many frames later it is still the same pose, not drifting.
    let t = 0;
    for (let i = 0; i < 100; i++) t = nextElapsed(t, 16, true);
    expect(t).toBe(FROZEN_POSE_MS);
  });

  test('tắt Giảm chuyển động thì thời gian tiến bình thường', () => {
    expect(nextElapsed(0, 16, false)).toBe(16);
    expect(nextElapsed(1000, 16, false)).toBe(1016);
  });
});
