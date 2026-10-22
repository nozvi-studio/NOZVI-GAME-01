import { describe, expect, test } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { levelAccess, nextLevelId } from '../src/domain/campaign.ts';
import { layoutCampaignMap } from '../src/presentation/galaxy/constellationLayout.ts';

const ids = (chapter: number) => campaignManifest.filter((e) => e.chapter === chapter).map((e) => e.id);
const upTo = (lastId: string) => {
  const end = campaignManifest.findIndex((e) => e.id === lastId);
  return campaignManifest.slice(0, end + 1).map((e) => e.id);
};

describe('Chương 3 trên bản đồ: chuỗi mở khóa', () => {
  test('3-1 chỉ mở khi đã qua 2-28; trước đó vẫn khóa kể cả khi 2-27 xong', () => {
    expect(levelAccess(campaignManifest, upTo('2-27'), '3-1').unlocked).toBe(false);
    const after = levelAccess(campaignManifest, upTo('2-28'), '3-1');
    expect(after).toEqual({ unlocked: true, completed: false, available: true });
  });

  test('mỗi màn chương 3 mở khi màn trước xong, màn sau vẫn khóa', () => {
    const chapter = ids(3);
    expect(chapter).toHaveLength(20);
    chapter.forEach((id, i) => {
      const completed = upTo(i === 0 ? '2-28' : chapter[i - 1]);
      expect(levelAccess(campaignManifest, completed, id).unlocked, `${id} mở`).toBe(true);
      if (i + 1 < chapter.length) expect(levelAccess(campaignManifest, completed, chapter[i + 1]).unlocked, `${chapter[i + 1]} khóa`).toBe(false);
    });
  });

  test('màn chương 3 đều sẵn sàng chơi trong harness; qua 2-28 và 3-20 nối đúng', () => {
    for (const id of ids(3)) expect(levelAccess(campaignManifest, [], id, 'campaign').available, id).toBe(true);
    for (const id of ids(3)) expect(levelAccess(campaignManifest, [], id, 'harness').available, id).toBe(true);
    expect(nextLevelId(campaignManifest, '2-28')).toBe('3-1');
    expect(nextLevelId(campaignManifest, '3-20')).toBeNull();
  });
});

describe('Chương 3 trên bản đồ: bố cục', () => {
  const layout = layoutCampaignMap(campaignManifest, [4, 5]);
  const nodes3 = layout.nodes.filter((n) => n.chapter === 3);
  const band3 = layout.chapters.find((c) => c.chapter === 3)!;

  test('hai mươi nút nằm trên bốn vòng nhẫn, xen kẽ nửa trái và nửa phải, luôn đi xuống', () => {
    expect(nodes3).toHaveLength(20);
    const rings = band3.art!;
    expect(rings).toHaveLength(4);
    nodes3.forEach((n, i) => {
      const ringIndex = Math.floor(i / 5);
      const ring = rings[ringIndex];
      // On the ring's ellipse (semi-axes 295 x 375, fixed by the artwork), to within pixel rounding.
      const onRing = ((n.x - ring.x) / 295) ** 2 + ((n.y - ring.y) / 375) ** 2;
      expect(onRing, n.id).toBeCloseTo(1, 1);
      const leftHalf = ringIndex % 2 === 0;
      expect(leftHalf ? n.x <= ring.x : n.x >= ring.x, `${n.id} bên ${leftHalf ? 'trái' : 'phải'} vòng`).toBe(true);
      expect(n.x, n.id).toBeGreaterThanOrEqual(150);
      expect(n.x, n.id).toBeLessThanOrEqual(570);
    });
    for (let i = 1; i < nodes3.length; i++) expect(nodes3[i].y - nodes3[i - 1].y, nodes3[i].id).toBeGreaterThanOrEqual(160);
  });

  test('nút 3-1 nằm dưới biển tiêu đề chương và cách 2-28 đủ xa để không đè huy hiệu', () => {
    const last2 = layout.nodes.find((n) => n.id === '2-28')!;
    expect(nodes3[0].y - band3.bannerY).toBeGreaterThanOrEqual(60);
    expect(nodes3[0].y - last2.y).toBeGreaterThanOrEqual(130);
    expect(band3.top).toBeGreaterThan(last2.y);
    expect(band3.top).toBeLessThan(nodes3[0].y);
  });

  test('dải chương 3 chứa đủ 20 nút và kết thúc trước dải chương 4', () => {
    const band4 = layout.chapters.find((c) => c.chapter === 4)!;
    expect(band3.nodeCount).toBe(20);
    expect(nodes3.at(-1)!.y).toBeLessThan(band3.bottom);
    expect(band3.bottom).toBe(band4.top);
    expect(band4.nodeCount).toBe(0);
  });
});
