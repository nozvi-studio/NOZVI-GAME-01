import { describe, expect, test } from 'vitest';
import {
  generateStarField,
  twinkleAlpha,
  driftOffset,
  DRIFT_PX_PER_MS,
} from '../src/presentation/sky/starField.ts';

const BOUNDS = { width: 720, height: 1280 };

describe('starField', () => {
  test('cùng seed cho cùng trường sao, khác seed cho trường khác', () => {
    const a = generateStarField(42, BOUNDS);
    const b = generateStarField(42, BOUNDS);
    const c = generateStarField(43, BOUNDS);

    expect(a).toEqual(b);
    expect(a.static[0]).not.toEqual(c.static[0]);
  });

  test('khoảng 120 sao tĩnh và 30 sao nhấp nháy, đúng tỉ lệ mockup', () => {
    const field = generateStarField(1, BOUNDS);
    expect(field.static).toHaveLength(120);
    expect(field.twinkling).toHaveLength(30);
    expect(field.static.every((s) => s.twinkles === false)).toBe(true);
    expect(field.twinkling.every((s) => s.twinkles === true)).toBe(true);
  });

  test('mọi sao nằm trong khung và có bán kính hợp lệ', () => {
    const field = generateStarField(7, BOUNDS);
    for (const star of [...field.static, ...field.twinkling]) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(BOUNDS.width);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(BOUNDS.height);
      expect(star.r).toBeGreaterThanOrEqual(0.6);
      expect(star.r).toBeLessThanOrEqual(1.7 * 1.846);
      expect(['#FFFFFF', '#CFE6FF', '#FFE8B8']).toContain(star.color);
    }
  });

  test('độ sáng nhấp nháy dao động quanh alpha gốc và không bao giờ âm', () => {
    const [star] = generateStarField(3, BOUNDS).twinkling;
    const samples = Array.from({ length: 64 }, (_, i) => twinkleAlpha(star, i * 50));

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    // Thật sự có dao động, không phải hằng số
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.2);
  });

  test('chu kỳ nhấp nháy lặp lại sau 3.2 giây', () => {
    const [star] = generateStarField(5, BOUNDS).twinkling;
    expect(twinkleAlpha(star, 1000)).toBeCloseTo(twinkleAlpha(star, 1000 + 3200), 5);
  });
});

describe('driftOffset', () => {
  test('tăng đều theo thời gian và quấn vòng theo chiều cao', () => {
    expect(driftOffset(0, 1280)).toBe(0);
    expect(driftOffset(1000, 1280)).toBeCloseTo(DRIFT_PX_PER_MS * 1000, 6);
    // Sau đúng một vòng thì trở về 0
    const oneLap = 1280 / DRIFT_PX_PER_MS;
    expect(driftOffset(oneLap, 1280)).toBeCloseTo(0, 6);
    expect(driftOffset(oneLap + 500, 1280)).toBeCloseTo(driftOffset(500, 1280), 6);
  });

  test('luôn nằm trong [0, height) nên không bao giờ lộ mép', () => {
    for (let ms = 0; ms < 200000; ms += 3137) {
      const v = driftOffset(ms, 1280);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1280);
    }
  });

  test('tốc độ trôi đủ chậm để không gây nhiễu thị giác', () => {
    // Dưới 1px mỗi khung hình ở 60fps
    expect(DRIFT_PX_PER_MS * 16.7).toBeLessThan(1);
    expect(DRIFT_PX_PER_MS).toBeGreaterThan(0);
  });
});
