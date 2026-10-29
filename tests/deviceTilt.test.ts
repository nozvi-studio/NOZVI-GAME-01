import { describe, expect, it } from 'vitest';
import { deviceTilt } from '../src/presentation/sky/deviceTilt.ts';

describe('DeviceTiltManager', () => {
  it('cung cấp độ nghiêng mặc định là 0', () => {
    deviceTilt.resetForTesting(0, 0);
    expect(deviceTilt.getTilt()).toEqual({ x: 0, y: 0 });
  });

  it('nội suy mượt mà qua các khung hình update', () => {
    deviceTilt.resetForTesting(0, 0);
    deviceTilt.setPointer(1, 1);
    deviceTilt.update(100);
    const tilt = deviceTilt.getTilt();
    expect(tilt.x).toBeGreaterThan(0);
    expect(tilt.y).toBeGreaterThan(0);
    expect(tilt.x).toBeLessThanOrEqual(1);
    expect(tilt.y).toBeLessThanOrEqual(1);
  });

  it('kẹp giá trị trong khoảng -1 đến 1', () => {
    deviceTilt.resetForTesting(0, 0);
    deviceTilt.setPointer(5, -5);
    deviceTilt.update(2000);
    const tilt = deviceTilt.getTilt();
    expect(tilt.x).toBeCloseTo(1, 1);
    expect(tilt.y).toBeCloseTo(-1, 1);
  });
});
