import { describe, expect, test } from 'vitest';
import {
  EASES,
  MOTION_FAMILIES,
  motionFamily,
  type MotionFamilyName,
  type MotionFamily,
} from '../src/presentation/transitions/motion.ts';
import { ANIM_TOKENS } from '../src/presentation/designTokens.ts';

describe('Bốn họ chuyển động', () => {
  test('đúng bốn họ, đúng tên', () => {
    expect(Object.keys(MOTION_FAMILIES).sort()).toEqual(['glass', 'magic', 'piece', 'ui']);
  });

  test('mọi ease được họ gọi tên đều tồn tại trong EASES', () => {
    // This is the assertion that stops a family drifting from the registry.
    for (const family of Object.values(MOTION_FAMILIES) as MotionFamily[]) {
      if (family.ease === null) continue;
      expect(Object.keys(EASES)).toContain(family.ease);
    }
  });

  test('họ ui có hai nhịp: báo nhận cú chạm nhanh hơn chuyển cảnh', () => {
    expect(MOTION_FAMILIES.ui.tapMs).toBeLessThan(MOTION_FAMILIES.ui.standardMs);
  });

  test('duration lấy từ ANIM_TOKENS, không chép lại số', () => {
    expect(MOTION_FAMILIES.ui.tapMs).toBe(ANIM_TOKENS.duration.buttonTapMs);
  });

  test('họ piece không có ease: chuyển động mảnh do POSE_TAU điều khiển', () => {
    expect(MOTION_FAMILIES.piece.ease).toBeNull();
    expect(MOTION_FAMILIES.piece.governedBy).toBe('POSE_TAU');
  });

  test('họ magic có dải thời lượng chứ không phải một giá trị', () => {
    expect(MOTION_FAMILIES.magic.minMs).toBeLessThan(MOTION_FAMILIES.magic.maxMs);
  });

  test('motionFamily trả về đúng bản ghi', () => {
    const names: MotionFamilyName[] = ['ui', 'glass', 'magic', 'piece'];
    for (const n of names) expect(motionFamily(n)).toBe(MOTION_FAMILIES[n]);
  });
});
