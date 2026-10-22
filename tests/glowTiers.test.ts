import { describe, expect, test } from 'vitest';
import { GLOW_TIERS, SCREEN_FOCUS, glowTier } from '../src/presentation/designTokens.ts';

describe('Thang glow bốn bậc', () => {
  test('bậc 0 là không phát sáng, không phải phát sáng rất nhẹ', () => {
    expect(GLOW_TIERS[0].blur).toBe(0);
    expect(GLOW_TIERS[0].alpha).toBe(0);
  });

  test('độ sáng tăng nghiêm ngặt theo bậc', () => {
    const blurs = [0, 1, 2, 3].map((t) => GLOW_TIERS[t as 0 | 1 | 2 | 3].blur);
    const sorted = [...blurs].sort((a, b) => a - b);
    expect(blurs).toEqual(sorted);
    expect(new Set(blurs).size).toBe(4);
  });

  test('mỗi màn khai báo đúng một tiêu điểm bậc 3', () => {
    expect(Object.keys(SCREEN_FOCUS).sort()).toEqual(['map', 'menu', 'play']);
    for (const name of Object.values(SCREEN_FOCUS)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('tiêu điểm của menu là nút Tiếp tục', () => {
    expect(SCREEN_FOCUS.menu).toBe('continueButton');
  });

  test('glowTier trả về đúng bản ghi', () => {
    expect(glowTier(3)).toBe(GLOW_TIERS[3]);
  });
});
