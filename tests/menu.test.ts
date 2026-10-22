import { describe, expect, test } from 'vitest';
import { COLOR_TOKENS, TYPO_TOKENS } from '../src/presentation/designTokens.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { levelAccess, resolveNextCampaignLevel } from '../src/domain/campaign.ts';

describe('Menu Campaign Navigation and Chapter Grouping', () => {
  test('58 màn chia vào các chương 10/28/20/0 (chương 4 khóa)', () => {
    const chapter = (c: number) => campaignManifest.filter((m) => m.chapter === c);
    expect([1, 2, 3, 4].map((c) => chapter(c).length)).toEqual([10, 28, 20, 0]);
    expect(chapter(1)[0].id).toBe('1-1');
    expect(chapter(2)[27].id).toBe('2-28');
  });

  test('trạng thái hiển thị menu trước khi chơi: 1-1 mở, 1-2 chưa mở', () => {
    const access1 = levelAccess(campaignManifest, [], '1-1');
    expect(access1.unlocked).toBe(true);
    expect(access1.completed).toBe(false);

    const access2 = levelAccess(campaignManifest, [], '1-2');
    expect(access2.unlocked).toBe(false);
  });

  test('sau khi hoàn thành 1-1: 1-1 là completed, 1-2 mở khoá và sẵn sàng', () => {
    const access1 = levelAccess(campaignManifest, ['1-1'], '1-1');
    expect(access1.completed).toBe(true);

    const access2 = levelAccess(campaignManifest, ['1-1'], '1-2');
    expect(access2.unlocked).toBe(true);
    expect(access2.available).toBe(true); // 1-2 đã approved
  });

  test('xác định đúng màn chơi kế tiếp an toàn (chỉ chọn màn approved, không trỏ vào màn planned gây crash)', () => {
    const res0 = resolveNextCampaignLevel(campaignManifest, []);
    expect(res0.level.id).toBe('1-1');
    expect(res0.type).toBe('start');

    // Sau khi đã chơi xong 1-1, 1-2 đã approved nên được chọn để chơi tiếp
    const res1 = resolveNextCampaignLevel(campaignManifest, ['1-1']);
    expect(res1.level.id).toBe('1-2');
    expect(res1.type).toBe('continue');
  });
});

describe('Màn chính theo mockup improve-v1', () => {
  test('màu nền canvas khớp chặng đầu của gradient trời', () => {
    expect(COLOR_TOKENS.sky.stops[0]).toBe('#1A2470');
  });

  test('tiêu đề game dùng cỡ chữ hero của bộ token', () => {
    // Nâng từ 52px khi đổi sang Cormorant Garamond: nét nó mảnh hơn Playfair
    // nên cùng cỡ sẽ chìm trên nền navy.
    expect(TYPO_TOKENS.fontSize.heroTitle).toBe('60px');
  });
});
