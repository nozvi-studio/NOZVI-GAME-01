import { describe, expect, it } from 'vitest';
import {
  computeDesignHeight,
  computeDesignView,
  computeViewport,
  safeAreaToDesignUnits,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  MAX_DPR,
  NO_SAFE_AREA,
} from '../src/presentation/viewport.ts';

describe('computeViewport', () => {
  it('đặt bộ đệm bằng số pixel vật lý', () => {
    // Máy trong ảnh chụp thực tế: 1080x2460 vật lý, dpr 3.
    const vp = computeViewport(360, 820, 3);
    expect(vp.bufferWidth).toBe(1080);
    expect(vp.bufferHeight).toBe(2460);
  });

  it('kẹp dpr để bộ đệm không phình trên màn siêu nét', () => {
    const vp = computeViewport(360, 820, 4.5);
    expect(vp.dpr).toBe(MAX_DPR);
    expect(vp.bufferWidth).toBe(360 * MAX_DPR);
  });

  it('coi dpr dưới 1 hoặc không hợp lệ là 1', () => {
    expect(computeViewport(360, 820, 0).dpr).toBe(1);
    expect(computeViewport(360, 820, Number.NaN).dpr).toBe(1);
  });

  it('làm tròn bộ đệm về pixel nguyên', () => {
    const vp = computeViewport(411.43, 867.43, 2.625);
    expect(Number.isInteger(vp.bufferWidth)).toBe(true);
    expect(Number.isInteger(vp.bufferHeight)).toBe(true);
  });

  it('quy đổi một đơn vị thiết kế ra đúng số pixel vật lý', () => {
    const vp = computeViewport(360, 820, 3);
    expect(vp.designScale).toBeCloseTo(1080 / DESIGN_WIDTH);
  });

  it('lùi về khung thiết kế khi kích thước cửa sổ vô nghĩa', () => {
    const vp = computeViewport(0, 0, 1);
    expect(vp.cssWidth).toBe(DESIGN_WIDTH);
    expect(vp.cssHeight).toBe(DESIGN_HEIGHT);
  });

  it('giới hạn bề ngang theo tỉ lệ 9:16 trên màn ngang desktop', () => {
    // Màn desktop 1920x1080, dpr 1: bề ngang bị kẹp về 1080 * (720/1280) = 607.5.
    const vp = computeViewport(1920, 1080, 1);
    expect(vp.cssWidth).toBeCloseTo(607.5);
    expect(vp.cssHeight).toBe(1080);
    expect(vp.bufferWidth).toBe(608);
    expect(vp.bufferHeight).toBe(1080);
    // Chiều cao thiết kế được giữ vững quanh chuẩn 1280 (1279 do làm tròn pixel bộ đệm) thay vì tụt xuống 405.
    expect(Math.abs(computeDesignHeight(vp.bufferWidth, vp.bufferHeight) - DESIGN_HEIGHT)).toBeLessThan(2);
  });

  it('không làm ảnh hưởng màn dọc điện thoại có tỉ lệ hẹp hơn hoặc bằng 9:16', () => {
    // Màn thoại iPhone/Android 390x844 (9:19.5): bề ngang 390 < 844 * (720/1280) = 474.75, giữ nguyên 390.
    const vp = computeViewport(390, 844, 3);
    expect(vp.cssWidth).toBe(390);
    expect(vp.cssHeight).toBe(844);
    expect(vp.bufferWidth).toBe(1170);
    expect(vp.bufferHeight).toBe(2532);
  });
});

describe('computeDesignHeight', () => {
  it('trả đúng khung thiết kế trên màn 9:16', () => {
    expect(computeDesignHeight(720, 1280)).toBeCloseTo(DESIGN_HEIGHT);
  });

  it('cao hơn 1280 trên màn dài, theo đúng tỉ lệ máy', () => {
    // 1080x2460 -> 720 * (2460/1080) = 1640
    expect(computeDesignHeight(1080, 2460)).toBeCloseTo(1640);
  });

  it('thấp hơn 1280 trên màn ngắn hơn 9:16', () => {
    expect(computeDesignHeight(1080, 1440)).toBeLessThan(DESIGN_HEIGHT);
  });

  it('giữ nguyên tỉ lệ: chiều cao thiết kế chia 720 bằng tỉ lệ bộ đệm', () => {
    const h = computeDesignHeight(1080, 2460);
    expect(h / DESIGN_WIDTH).toBeCloseTo(2460 / 1080);
  });

  it('lùi về 1280 khi bộ đệm vô nghĩa', () => {
    expect(computeDesignHeight(0, 0)).toBe(DESIGN_HEIGHT);
  });
});

describe('computeDesignView', () => {
  it('luôn bắt đầu từ gốc toạ độ', () => {
    const view = computeDesignView(1080, 2460);
    expect(view.x).toBe(0);
    expect(view.y).toBe(0);
  });

  it('rộng đúng 720 bất kể máy nào', () => {
    expect(computeDesignView(1080, 2460).width).toBe(DESIGN_WIDTH);
    expect(computeDesignView(1440, 2560).width).toBe(DESIGN_WIDTH);
  });
});

describe('safeAreaToDesignUnits', () => {
  it('quy đổi lề từ pixel CSS sang đơn vị thiết kế', () => {
    // Màn rộng 360 pixel CSS -> 1 pixel CSS bằng 2 đơn vị thiết kế.
    const safe = safeAreaToDesignUnits({ top: 24, right: 0, bottom: 16, left: 0 }, 360);
    expect(safe.top).toBeCloseTo(48);
    expect(safe.bottom).toBeCloseTo(32);
  });

  it('coi lề âm là không có lề', () => {
    const safe = safeAreaToDesignUnits({ top: -5, right: 0, bottom: 0, left: 0 }, 360);
    expect(safe.top).toBe(0);
  });

  it('trả lề rỗng khi bề ngang vô nghĩa', () => {
    expect(safeAreaToDesignUnits({ top: 24, right: 0, bottom: 0, left: 0 }, 0)).toEqual(NO_SAFE_AREA);
  });
});
