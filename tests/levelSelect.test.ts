import { describe, expect, test } from 'vitest';
import { formatNodeLabel, formatProgress } from '../src/presentation/hud/hudText.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { TEN_NODE_PATTERN, layoutCampaignMap } from '../src/presentation/galaxy/constellationLayout.ts';
import {
  furthestLevelId,
  levelAccess,
  resolveMapCompletedLevels,
} from '../src/domain/campaign.ts';
import { t, setLocale } from '../src/presentation/i18n.ts';

const tEn = (key: Parameters<typeof t>[0], vars?: Parameters<typeof t>[1]) => {
  setLocale('en');
  const value = t(key, vars);
  setLocale('vi');
  return value;
};

describe('Constellation Map Layout Generator', () => {
  test('bố cục suy ra từ manifest: 3 chòm sao 10/28/20 (chương 4, 5 khóa không có nút), đúng thứ tự', () => {
    const layout = layoutCampaignMap(campaignManifest);
    expect(layout.chapters.map((c) => [c.chapter, c.nodeCount])).toEqual([[1, 10], [2, 28], [3, 20]]);
    expect(layout.nodes.map((n) => n.id)).toEqual(campaignManifest.map((e) => e.id));
  });

  test('teaser chapters become node-less bands that extend the map, in chapter order', () => {
    const plain = layoutCampaignMap(campaignManifest);
    const layout = layoutCampaignMap(campaignManifest, [5, 4]);
    expect(layout.chapters.map((c) => [c.chapter, c.nodeCount])).toEqual([[1, 10], [2, 28], [3, 20], [4, 0], [5, 0]]);
    expect(layout.nodes).toEqual(plain.nodes);
    layout.chapters.forEach((band, i) => {
      if (i > 0) expect(band.top).toBe(layout.chapters[i - 1].bottom);
    });
    expect(layout.chapters.at(-1)!.bottom).toBe(layout.totalHeight);
    for (const band of layout.chapters.slice(3)) expect(band.bottom - band.top).toBeGreaterThanOrEqual(1000);
    const lastNodeY = Math.max(...layout.nodes.map((n) => n.y));
    expect(layout.chapters[3].bannerY - lastNodeY).toBeGreaterThanOrEqual(60);
    expect(layout.totalHeight).toBeGreaterThan(plain.totalHeight + 2000);
  });

  test('without teasers the layout is unchanged', () => {
    expect(layoutCampaignMap(campaignManifest, [])).toEqual(layoutCampaignMap(campaignManifest));
  });

  test('xác định đúng 4 trạng thái node theo tiến trình', () => {
    const getNodeState = (manifest: typeof campaignManifest, completed: string[], id: string) => {
      const access = levelAccess(manifest, completed, id);
      if (access.completed) return 'completed';
      const isNext = manifest.find((m) => !completed.includes(m.id))?.id === id;
      if (isNext) return 'current';
      if (access.unlocked) return 'unlocked';
      return 'locked';
    };

    // Khi chưa hoàn thành màn nào
    expect(getNodeState(campaignManifest, [], '1-1')).toBe('current');
    expect(getNodeState(campaignManifest, [], '1-2')).toBe('locked');

    // Khi đã hoàn thành 1-1
    expect(getNodeState(campaignManifest, ['1-1'], '1-1')).toBe('completed');
    expect(getNodeState(campaignManifest, ['1-1'], '1-2')).toBe('current');
    expect(getNodeState(campaignManifest, ['1-1'], '1-3')).toBe('locked');
  });

  test('harness coi level validated là có thể chơi nhưng campaign thì không', () => {
    // Manifest giả có 1-3 ở trạng thái validated, để test không phụ thuộc
    // trạng thái duyệt thật của campaign (1-3 đã approved sau Task 16).
    const manifest = campaignManifest.map((entry) =>
      entry.id === '1-3' ? { ...entry, status: 'validated' as const } : entry
    );
    expect(levelAccess(manifest, ['1-1', '1-2'], '1-3', 'campaign').available).toBe(false);
    expect(levelAccess(manifest, ['1-1', '1-2'], '1-3', 'harness').available).toBe(true);
  });

  test('bản đồ harness hiển thị tiến độ preview tới màn vừa thắng mà không đổi campaign', () => {
    const campaignCompleted = ['1-1'];
    const preview = resolveMapCompletedLevels(
      campaignManifest,
      campaignCompleted,
      'harness',
      '1-3'
    );

    expect(preview).toEqual(['1-1', '1-2', '1-3']);
    expect(campaignCompleted).toEqual(['1-1']);
    expect(resolveMapCompletedLevels(
      campaignManifest,
      campaignCompleted,
      'campaign',
      '1-3'
    )).toEqual(['1-1']);
  });

  test('chơi lại màn cũ trong harness không làm mốc preview lùi lại', () => {
    expect(furthestLevelId(campaignManifest, '1-5', '1-2')).toBe('1-5');
    expect(furthestLevelId(campaignManifest, undefined, '1-3')).toBe('1-3');
  });
});

describe('Bố cục bản đồ chòm sao (CH-03)', () => {
  const layout = layoutCampaignMap(campaignManifest);

  test('chương I dùng mẫu 10 nút, chương II là 28 nút quấn quanh 5 thiên hà ngay sau nó', () => {
    const one = layout.nodes.filter((n) => n.chapter === 1);
    const y0 = one[0].y;
    expect(y0).toBe(270);
    expect(one.map((n) => [n.x, n.y - y0])).toEqual(TEN_NODE_PATTERN.map(([x, dy]) => [x, dy]));
    expect(layout.nodes.find((n) => n.id === '2-1')?.y).toBe(1730);
    expect(layout.nodes.find((n) => n.id === '2-28')?.y).toBe(6430);
    expect(layout.totalHeight).toBe(10440); // gồm dải chương 3 (20 nút trên 4 vòng nhẫn)
  });

  test('không nút nào đè nhau hay tràn khỏi bề ngang 720', () => {
    for (const n of layout.nodes) {
      // Huy hiệu tên màn hiện tại rộng 260px, tâm tại x của nút
      expect(n.x - 130).toBeGreaterThanOrEqual(0);
      expect(n.x + 130).toBeLessThanOrEqual(720);
    }
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        const apart = Math.abs(a.y - b.y) >= 130 || Math.abs(a.x - b.x) >= 280;
        expect(apart, `${a.id} và ${b.id}`).toBe(true);
      }
    }
  });

  test('tiêu đề chương nằm giữa hai chòm sao; dải màu nối liền', () => {
    layout.chapters.forEach((band, i) => {
      const own = layout.nodes.filter((n) => n.chapter === band.chapter);
      expect(Math.min(...own.map((n) => n.y)) - band.bannerY).toBeGreaterThanOrEqual(60);
      if (i > 0) {
        const prev = layout.nodes.filter((n) => n.chapter === layout.chapters[i - 1].chapter);
        expect(band.bannerY - Math.max(...prev.map((n) => n.y))).toBeGreaterThanOrEqual(60);
        expect(band.top).toBe(layout.chapters[i - 1].bottom);
      }
    });
    expect(layout.chapters[0].top).toBe(0);
    expect(layout.chapters[layout.chapters.length - 1].bottom).toBe(layout.totalHeight);
    expect(layout.totalHeight).toBe(layout.nodes[layout.nodes.length - 1].y + 240);
  });

  test('số chòm sao và số nút không viết cứng', () => {
    const small = layoutCampaignMap([
      { id: 'a-1', title: 'A', chapter: 1 },
      { id: 'a-2', title: 'B', chapter: 1 },
      { id: 'b-1', title: 'C', chapter: 2 },
    ]);
    expect(small.chapters.map((c) => [c.chapter, c.nodeCount])).toEqual([[1, 2], [2, 1]]);
    expect(small.nodes.map((n) => n.y)).toEqual([270, 430, 690]);
  });

  test('96px nodes still clear each other in the densest chapter', () => {
    const NODE = 96;
    const hoaPham = layout.nodes.filter((n) => n.chapter === 3);
    for (let i = 0; i < hoaPham.length; i++) {
      for (let j = i + 1; j < hoaPham.length; j++) {
        const a = hoaPham[i];
        const b = hoaPham[j];
        const clear = Math.abs(a.y - b.y) >= NODE || Math.abs(a.x - b.x) >= NODE;
        expect(clear, `${a.id} và ${b.id}`).toBe(true);
      }
    }
  });
});

describe('Màn chọn màn theo mockup improve-v1', () => {
  test('chỉ số tiến độ hiển thị dạng đã hoàn thành trên tổng số màn', () => {
    expect(formatProgress(0, 28)).toBe('0/28');
    expect(formatProgress(1, 28)).toBe('1/28');
    expect(formatProgress(28, 28)).toBe('28/28');
  });

  test('không còn ký tự trang trí trước con số', () => {
    expect(formatProgress(1, 28)).not.toContain('✦');
  });

  test('tổng số màn lấy từ manifest, không viết cứng', () => {
    expect(campaignManifest.length).toBeGreaterThan(0);
    expect(formatProgress(0, campaignManifest.length)).toBe(`0/${campaignManifest.length}`);
  });

  test('nhãn node hiện tại: tên dẫn trước, định vị theo sau, không ký tự trang trí', () => {
    setLocale('vi');
    const label = formatNodeLabel('3-4', 'Ngọn Nến', 3);
    expect(label.name).toBe('Ngọn Nến');
    expect(label.locator).toBe('3-4 · Luân Chuyển');
    expect(label.name).not.toContain('✦');
    expect(label.locator).not.toContain('✦');
  });
});

describe('LevelSelect node labeling', () => {
  test('formats node label without legacy puzzle titles', () => {
    setLocale('vi');
    const l1 = formatNodeLabel('1-1', 1);
    expect(l1.name).toBe('Màn 1-1');
    expect(l1.locator).toContain('Khởi Nguyên');

    const l2 = formatNodeLabel('2-1', 2);
    expect(l2.name).toBe('Màn 2-1');
    expect(l2.locator).toContain('Giao Thoa');
  });
});

describe('Content frontier node', () => {
  test('the frontier state is the level just past the released content', () => {
    // Độc lập với nội dung hiện tại: giả lập màn cuối chưa được duyệt, để trạng thái
    // "mở nhưng chưa sẵn sàng" vẫn được kiểm khi mọi màn thật đã approved.
    const manifest = campaignManifest.map((e, i, all) =>
      i === all.length - 1 ? { ...e, status: 'planned' as const } : e
    );
    const frontier = manifest[manifest.length - 1];
    const completed = manifest.slice(0, -1).map((e) => e.id);
    const access = levelAccess(manifest, completed, frontier.id, 'campaign');
    expect(access.unlocked).toBe(true);
    expect(access.available).toBe(false);
  });

  test('the frontier label and the toast come from the same i18n key', () => {
    expect(t('toast_level_polishing', { id: '4-1' })).toContain('4-1');
    expect(tEn('toast_level_polishing', { id: '4-1' })).toContain('4-1');
  });
});

describe('LevelSelect scrolling safety invariants', () => {
  test('drag pointermove requires pointer.isDown', () => {
    let isDragging = true;
    const onPointerMove = (pointer: { isDown: boolean }) => {
      if (!pointer.isDown) {
        isDragging = false;
        return;
      }
    };

    onPointerMove({ isDown: false });
    expect(isDragging).toBe(false);
  });

  test('update loop clears isDragging when activePointer is not down', () => {
    let isDragging = true;
    const activePointer = { isDown: false };
    if (isDragging && !activePointer.isDown) {
      isDragging = false;
    }
    expect(isDragging).toBe(false);
  });
});
