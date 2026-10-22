import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_SIZES,
  orientationFamilies,
  previewPoints,
  snapFrameSize,
  validFrameSizes,
} from '../src/studio/orientationOptions.ts';

describe('orientationFamilies', () => {
  it('chia tam giác thành hai họ Góc và Mái', () => {
    const families = orientationFamilies('triangle');
    expect(families).toHaveLength(2);
    expect(families[0].label).toBe('Góc');
    expect(families[0].orientations).toEqual([0, 1, 2, 3]);
    expect(families[1].label).toBe('Mái');
    expect(families[1].orientations).toEqual([4, 5, 6, 7]);
  });

  it('bình hành có một họ bốn hướng', () => {
    const families = orientationFamilies('parallelogram');
    expect(families).toHaveLength(1);
    expect(families[0].orientations).toEqual([0, 1, 2, 3]);
  });

  it('hình chỉ có hướng 0 thì không có họ nào', () => {
    expect(orientationFamilies('square')).toEqual([]);
    expect(orientationFamilies('diamond')).toEqual([]);
    expect(orientationFamilies('circle')).toEqual([]);
  });
});

describe('validFrameSizes', () => {
  it('họ Góc nhận bội của 8', () => {
    expect(validFrameSizes('triangle', 0)).toEqual(CANDIDATE_SIZES.filter((s) => s % 8 === 0));
    expect(validFrameSizes('triangle', 0)).toContain(40);
  });

  it('họ Mái chỉ nhận bội của 16', () => {
    const sizes = validFrameSizes('triangle', 4);
    expect(sizes).toEqual([16, 32, 48, 64, 80, 96, 112, 128]);
    expect(sizes).not.toContain(40);
  });

  it('bình hành nhận các cỡ là bội của 24', () => {
    const sizes = validFrameSizes('parallelogram', 0);
    expect(sizes).toEqual([24, 48, 72, 96, 120]);
    expect(sizes).toContain(24);
    expect(sizes).toContain(72);
  });
});

describe('snapFrameSize', () => {
  it('giữ nguyên cỡ còn hợp lệ', () => {
    expect(snapFrameSize('triangle', 4, 48)).toBe(48);
  });

  it('nhảy sang cỡ hợp lệ đầu tiên khi đổi sang họ Mái', () => {
    expect(snapFrameSize('triangle', 4, 40)).toBe(16);
  });
});

describe('previewPoints', () => {
  it('mái hướng lên có đỉnh ở giữa hộp', () => {
    expect(previewPoints('triangle', 4, 24)).toBe('0,24 24,24 12,12');
  });

  it('mái hướng xuống có đáy ở cạnh trên', () => {
    expect(previewPoints('triangle', 6, 24)).toBe('0,0 24,0 12,12');
  });

  it('vuông phủ kín hộp', () => {
    expect(previewPoints('square', 0, 24)).toBe('0,0 24,0 24,24 0,24');
  });
});
