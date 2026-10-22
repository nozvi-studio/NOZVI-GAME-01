import { describe, expect, test } from 'vitest';
import { TEXTURE_KEYS } from '../src/presentation/TextureFactory.ts';
import { GLASS_TOKENS } from '../src/presentation/designTokens.ts';

describe('TextureFactory Constants and Keys', () => {
  test('chứa đầy đủ các khóa texture cần thiết cho toàn bộ UI', () => {
    expect(TEXTURE_KEYS.steleBorder).toBe('stele_border_9slice');
    expect(TEXTURE_KEYS.btnCircle64).toBe('btn_circle_64');
    expect(TEXTURE_KEYS.btnCircle56).toBe('btn_circle_56');
    expect(TEXTURE_KEYS.iconReset).toBe('icon_reset');
    expect(TEXTURE_KEYS.iconRotate).toBe('icon_rotate');
    expect(TEXTURE_KEYS.iconGear).toBe('icon_gear');
    expect(TEXTURE_KEYS.nodeCurrent).toBe('node_current');
    expect(TEXTURE_KEYS.nodeCompleted).toBe('node_completed');
    expect(TEXTURE_KEYS.nodeUnlocked).toBe('node_unlocked');
    expect(TEXTURE_KEYS.nodeLocked).toBe('node_locked');
  });

  test('có khoá texture khung kính cho bàn và khay', () => {
    expect(TEXTURE_KEYS.glassFrameBoard).toBe('glass_frame_board');
    expect(TEXTURE_KEYS.glassFrameTray).toBe('glass_frame_tray');
  });

  test('khung kính dùng đúng bốn chặng màu băng của mockup', () => {
    expect(GLASS_TOKENS.frameStops).toEqual(['#E6F7FF', '#8BD3F5', '#4E9BD0', '#2D5E9A']);
    expect(GLASS_TOKENS.cornerRadius).toBe(30);
    expect(GLASS_TOKENS.padding).toBe(6);
  });
});
