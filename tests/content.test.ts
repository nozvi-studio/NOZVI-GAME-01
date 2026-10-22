import { describe, expect, test } from 'vitest';
import { makeAdjacentFixture } from '../src/content/fixtures.ts';
import { validateLevel } from '../src/content/validate.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { buildLevelDocument } from '../src/content/authoring.ts';
import type { LevelSource } from '../src/content/authoring.ts';
import { CHAPTERS, RELEASE_LEVEL_COUNT, chapterInfo, chapterLabel, chapterOfLevelId, chapterRoman, releaseGate } from '../src/content/chapters.ts';

/** Các màn đã có dữ liệu ngoài 1-1; trạng thái phải là validated hoặc approved */
const AUTHORED_LEVELS = new Set(['1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10', '2-11', '2-12', '2-13', '2-14', '2-15', '2-16', '2-17', '2-18', '2-19', '2-20', '2-21', '2-22', '2-23', '2-24', '2-25', '2-26', '2-27', '2-28', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10', '3-11', '3-12', '3-13', '3-14', '3-15', '3-16', '3-17', '3-18', '3-19', '3-20']);

describe('Level Content and Validation', () => {
  test('không đổi target theo nghiệm nhập sai', () => {
    const doc = makeAdjacentFixture();
    const initial = validateLevel(doc);
    expect(initial.ok).toBe(true);

    // Thay đổi anchor của nghiệm mẫu thành sai vị trí -> phải phát hiện mismatch
    doc.sampleSolutions[0][0].anchorId = 'B';
    const result = validateLevel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'solution-target-mismatch')).toBe(true);
    }
  });

  test('phát hiện duplicate piece ID', () => {
    const doc = makeAdjacentFixture();
    doc.pieces.push({ ...doc.pieces[0] });
    const result = validateLevel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'duplicate-piece-id')).toBe(true);
    }
  });

  test('phát hiện targetCells rỗng', () => {
    const doc = makeAdjacentFixture();
    doc.targetCells = [];
    const result = validateLevel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'empty-target')).toBe(true);
    }
  });

  test('phát hiện unknown anchor trong solution', () => {
    const doc = makeAdjacentFixture();
    doc.sampleSolutions[0][0].anchorId = 'NONEXISTENT';
    const result = validateLevel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'unknown-anchor')).toBe(true);
    }
  });

  test('cấm xoay hoặc turns > 0 trong Chapter 1', () => {
    const doc = makeAdjacentFixture();
    doc.rotationEnabled = true;
    const res1 = validateLevel(doc);
    expect(res1.ok).toBe(false);
    if (!res1.ok) {
      expect(res1.issues.some((i) => i.code === 'chapter-rotation-disabled')).toBe(true);
    }

    const doc2 = makeAdjacentFixture();
    doc2.sampleSolutions[0][0].turns = 1;
    const res2 = validateLevel(doc2);
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.issues.some((i) => i.code === 'solution-rotation-disallowed')).toBe(true);
    }
  });

  test('cấm vùng giao (xếp chồng) trong nghiệm Chapter 1', () => {
    const doc = makeAdjacentFixture();
    // Đặt D2 cùng neo với D1 (16, 56) khiến 2 mảnh đè lên nhau
    doc.pieces[1].anchors[0] = { id: 'A', x: 24, y: 76 };
    doc.sampleSolutions[0][1].anchorId = 'A';
    const result = validateLevel(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'chapter-1-no-overlap')).toBe(true);
    }
  });

  test('manifest 58 màn, order liên tục, chương 10/28/20/0', () => {
    expect(campaignManifest).toHaveLength(58);
    expect(campaignManifest.map((e) => e.order)).toEqual(Array.from({ length: 58 }, (_, i) => i + 1));
    const ids = (chapter: number) => campaignManifest.filter((e) => e.chapter === chapter).map((e) => e.id);
    expect(ids(1)).toEqual(Array.from({ length: 10 }, (_, i) => `1-${i + 1}`));
    expect(ids(2)).toEqual(Array.from({ length: 28 }, (_, i) => `2-${i + 1}`));
    expect(ids(3)).toEqual(Array.from({ length: 20 }, (_, i) => `3-${i + 1}`));
    expect(ids(4)).toEqual([]);
    expect(campaignManifest[0].id).toBe('1-1');
    expect(campaignManifest[0].status).toBe('approved');
    for (const entry of campaignManifest.slice(1)) {
      if (AUTHORED_LEVELS.has(entry.id)) {
        expect(['validated', 'approved']).toContain(entry.status);
      } else {
        expect(entry.status).toBe('planned');
      }
    }
  });

  test('tên màn chương 2–4 theo spec B (CH-02)', () => {
    const titles = (chapter: number) => campaignManifest.filter((e) => e.chapter === chapter).map((e) => e.title);
    const t2 = titles(2);
    expect([0, 3, 4, 5].map((i) => t2[i])).toEqual(['Mũi Tên Chỉ Thiên', 'Mắt Thần', 'Đồng Hồ Cát', 'Hộ Mệnh']);
    expect(t2.slice(6, 13)).toEqual([
      'Nhật Nguyệt Song Huyền', 'Thuyền Buồm Hoàng Hôn', 'Mèo Thần', 'Hoa Sen', 'Kim Tự Tháp Nhật Thực',
      'Sao Bát Phương', 'Mandala Thiên Cầu',
    ]);
  });
});

describe('Bốn chương và luật xoay (CH-01, CH-04)', () => {
  const codes = (r: ReturnType<typeof validateLevel>) => (r.ok ? [] : r.issues.map((i) => i.code));

  test('bảng chương: tên, số La Mã, chỉ chương 3 xoay', () => {
    expect(CHAPTERS.map((c) => [c.chapter, c.roman, c.name, c.rotationEnabled])).toEqual([
      [1, 'I', 'Khởi Nguyên', false], [2, 'II', 'Giao Thoa', false],
      [3, 'III', 'Luân Chuyển', true], [4, 'IV', 'Hội Tụ', false],
      [5, 'V', 'Lăng Kính', false],
    ]);
    expect(chapterInfo(6)).toBeUndefined();
    expect(chapterOfLevelId('3-10')).toBe(3);
    expect(chapterOfLevelId('4-1')).toBe(4);
    expect(chapterOfLevelId('5-2')).toBe(5);
    expect(chapterOfLevelId('dev-shapes-v2')).toBeUndefined();
    expect(chapterLabel(3)).toBe('Chương III · Luân Chuyển');
    expect(chapterLabel(5)).toBe('Chương V · Lăng Kính');
    expect(chapterRoman(5)).toBe('V');
    expect(chapterRoman(9)).toBe('9');
  });

  // Nghiệm xoay 1 nấc, không chồng: D2 đứng cạnh D1 (fixture mặc định)
  const rotatedChapter3 = () => {
    const doc = makeAdjacentFixture();
    doc.chapter = 3;
    doc.rotationEnabled = true;
    doc.sampleSolutions[0][0].turns = 1;
    return doc;
  };

  test('chương 3 bật xoay (có nấc xoay, không chồng) thì không dính luật xoay', () => {
    const issues = codes(validateLevel(rotatedChapter3()));
    expect(issues).not.toContain('chapter-rotation-disabled');
    expect(issues).not.toContain('chapter-rotation-required');
    expect(issues).not.toContain('chapter-3-no-overlap');
    expect(issues).not.toContain('chapter-3-needs-rotation');
  });

  test('chương 3 bật xoay nhưng nghiệm không có nấc xoay báo chapter-3-needs-rotation', () => {
    const doc = makeAdjacentFixture();
    doc.chapter = 3;
    doc.rotationEnabled = true;
    expect(codes(validateLevel(doc))).toContain('chapter-3-needs-rotation');
  });

  test('cấm vùng giao (xếp chồng) trong nghiệm Chapter 3', () => {
    const doc = rotatedChapter3();
    doc.pieces[1].anchors[0] = { id: 'A', x: 24, y: 76 };
    doc.sampleSolutions[0][1].anchorId = 'A';
    expect(codes(validateLevel(doc))).toContain('chapter-3-no-overlap');
  });

  test('chương 1, 2, 4, 5 bật xoay báo chapter-rotation-disabled', () => {
    for (const chapter of [1, 2, 4, 5] as const) {
      const doc = makeAdjacentFixture();
      doc.chapter = chapter;
      doc.rotationEnabled = true;
      expect(codes(validateLevel(doc))).toContain('chapter-rotation-disabled');
    }
  });

  test('chương 3 tắt xoay báo chapter-rotation-required', () => {
    const doc = makeAdjacentFixture();
    doc.chapter = 3;
    doc.rotationEnabled = false;
    expect(codes(validateLevel(doc))).toContain('chapter-rotation-required');
  });

  test('chương ngoài 1–5 báo invalid-chapter; turns ≠ 0 ở chương 2 bị cấm', () => {
    const bad = makeAdjacentFixture() as unknown as { chapter: number };
    bad.chapter = 6;
    expect(codes(validateLevel(bad))).toContain('invalid-chapter');
    const turned = makeAdjacentFixture();
    turned.chapter = 2;
    turned.sampleSolutions[0][0].turns = 1;
    expect(codes(validateLevel(turned))).toContain('solution-rotation-disallowed');
  });

  test('cổng release cần đủ 58 màn approved và manifest hiện đạt cổng', () => {
    expect(RELEASE_LEVEL_COUNT).toBe(58);
    expect(campaignManifest).toHaveLength(RELEASE_LEVEL_COUNT);
    const gate = releaseGate(campaignManifest);
    expect(gate).toEqual({ ok: true, approved: 58, required: 58 });
    const full = Array.from({ length: RELEASE_LEVEL_COUNT }, (_, i) => ({ ...campaignManifest[i % campaignManifest.length], status: 'approved' as const }));
    expect(releaseGate(full)).toEqual({ ok: true, approved: 58, required: 58 });
    const allApproved = campaignManifest.map((e) => ({ ...e, status: 'approved' as const }));
    expect(releaseGate(allApproved.slice(0, 18)).ok).toBe(false);
    expect(releaseGate(campaignManifest.map((e, i) => (i === 0 ? { ...e, status: 'validated' as const } : e))).ok).toBe(false);
  });
});

describe('Hình mảnh, hướng và placement mục tiêu (CH1-04)', () => {
  const triangleSource: LevelSource = {
    id: 'test-tri', title: 'Tam giác thử', chapter: 1, order: 1,
    contentRevision: 't1', rotationEnabled: false,
    pieces: [{ id: 'T1', shapeKind: 'triangle', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 40, y: 56 }] }],
    sampleSolutions: [[{ pieceId: 'T1', anchorId: 'A', turns: 0 }]],
    learningObjective: 'thử', difficultyEstimate: 1, distractors: [], ftueSteps: [],
  };

  function codes(doc: unknown): string[] {
    const result = validateLevel(doc);
    return result.ok ? [] : result.issues.map((i) => i.code);
  }

  test('tam giác hợp lệ mang shapeKind, orientation và targetPlacements', () => {
    const result = validateLevel(buildLevelDocument(triangleSource));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.level.pieces[0].shapeKind).toBe('triangle');
      expect(result.level.pieces[0].orientation).toBe(2);
      expect(result.level.targetPlacements).toEqual([{ pieceId: 'T1', x: 40, y: 56, turns: 0 }]);
    }
  });

  test('tam giác thiếu orientation bị từ chối', () => {
    const doc = buildLevelDocument(triangleSource);
    delete doc.pieces[0].orientation;
    expect(codes(doc)).toContain('invalid-orientation');
  });

  test('orientation ngoài 0–7 bị từ chối', () => {
    const doc = buildLevelDocument(triangleSource);
    (doc.pieces[0] as { orientation?: number }).orientation = 9;
    expect(codes(doc)).toContain('invalid-orientation');
  });

  test('orientation null với cells hướng 0 bị từ chối', () => {
    const doc = buildLevelDocument({
      ...triangleSource,
      pieces: [{ ...triangleSource.pieces[0], orientation: 0 }],
    });
    (doc.pieces[0] as unknown as { orientation: null }).orientation = null;
    expect(codes(doc)).toContain('invalid-orientation');
  });

  test('thoi có orientation khác 0 bị từ chối', () => {
    const doc = makeAdjacentFixture();
    doc.pieces[0].orientation = 3;
    expect(codes(doc)).toContain('invalid-orientation');
  });

  test('shapeKind lạ bị từ chối', () => {
    const doc = makeAdjacentFixture() as unknown as { pieces: Array<{ shapeKind: string }> };
    doc.pieces[0].shapeKind = 'hexagon';
    expect(codes(doc)).toContain('invalid-shape-kind');
  });

  test('cells sửa tay lệch khỏi hình bị từ chối', () => {
    const doc = makeAdjacentFixture();
    doc.pieces[0].cells = doc.pieces[0].cells.slice(1);
    expect(codes(doc)).toContain('shape-cells-mismatch');
  });

  test('fixture kỹ thuật theo quy tắc ô biên mới: 800 ô mỗi thoi, hợp lệ', () => {
    const doc = makeAdjacentFixture();
    expect(doc.pieces.map((p) => p.cells.length)).toEqual([800, 800]);
    expect(validateLevel(doc).ok).toBe(true);
  });
});

describe('Hình tròn, bình hành và khung theo loại hình (spec A)', () => {
  function oneShape(
    shapeKind: LevelSource['pieces'][number]['shapeKind'],
    orientation: LevelSource['pieces'][number]['orientation'],
    frameSize: number
  ): LevelSource {
    return {
      id: 'test-shape',
      title: 'Hình thử',
      chapter: 2,
      order: 7,
      contentRevision: 't1',
      rotationEnabled: false,
      pieces: [{ id: 'P1', shapeKind, orientation, frameSize, anchors: [{ id: 'A', x: 32, y: 48 }] }],
      sampleSolutions: [[{ pieceId: 'P1', anchorId: 'A', turns: 0 }]],
      learningObjective: 'thử',
      difficultyEstimate: 1,
      distractors: [],
      ftueSteps: [],
    };
  }

  function codes(doc: unknown): string[] {
    const result = validateLevel(doc);
    return result.ok ? [] : result.issues.map((i) => i.code);
  }

  test('hình tròn và bình hành hợp lệ mang đúng shapeKind/orientation', () => {
    const circle = validateLevel(buildLevelDocument(oneShape('circle', 0, 64)));
    expect(circle.ok).toBe(true);
    const para = validateLevel(buildLevelDocument(oneShape('parallelogram', 2, 48)));
    expect(para.ok).toBe(true);
    if (para.ok) {
      expect(para.level.pieces[0].shapeKind).toBe('parallelogram');
      expect(para.level.pieces[0].orientation).toBe(2);
    }
  });

  test('bình hành thiếu orientation bị từ chối; hình tròn hướng 1 bị từ chối', () => {
    const para = buildLevelDocument(oneShape('parallelogram', 1, 48));
    delete para.pieces[0].orientation;
    expect(codes(para)).toContain('invalid-orientation');
    const circle = buildLevelDocument(oneShape('circle', 0, 32));
    (circle.pieces[0] as { orientation?: number }).orientation = 1;
    expect(codes(circle)).toContain('invalid-orientation');
  });

  test('khung sai cấu trúc bị từ chối với invalid-frame-for-shape', () => {
    const para = buildLevelDocument(oneShape('parallelogram', 0, 48));
    para.pieces[0].frameSize = 32;
    expect(codes(para)).toContain('invalid-frame-for-shape');
    const circle = buildLevelDocument(oneShape('circle', 0, 16));
    circle.pieces[0].frameSize = 15;
    expect(codes(circle)).toContain('invalid-frame-for-shape');
  });

  test('fixture kỹ thuật thoi khung 40 vẫn hợp lệ (khung đúng cấu trúc)', () => {
    expect(validateLevel(makeAdjacentFixture()).ok).toBe(true);
  });
});

describe('Chế độ đặt mảnh (spec D, FP-01/FP-02)', () => {
  const freeSource: LevelSource = {
    id: 'test-free',
    title: 'Đặt tự do thử',
    chapter: 2,
    order: 900,
    contentRevision: 't1',
    rotationEnabled: false,
    placement: 'free',
    pieces: [
      { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 16 }] },
      { id: 'D1', shapeKind: 'diamond', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 64 }] },
    ],
    sampleSolutions: [
      [
        { pieceId: 'S1', anchorId: 'A', turns: 0 },
        { pieceId: 'D1', anchorId: 'A', turns: 0 },
      ],
    ],
    learningObjective: 'thử',
    difficultyEstimate: 1,
    distractors: [],
    ftueSteps: [],
  };

  function codesOf(doc: unknown): string[] {
    const result = validateLevel(doc);
    return result.ok ? [] : result.issues.map((i) => i.code);
  }

  test('thiếu placement thì validator coi là anchors', () => {
    const result = validateLevel(makeAdjacentFixture());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.level.placement).toBe('anchors');
  });

  test('màn free hợp lệ mang placement free', () => {
    const result = validateLevel(buildLevelDocument(freeSource));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.level.placement).toBe('free');
  });

  test('placement lạ bị từ chối', () => {
    const doc = buildLevelDocument(freeSource);
    (doc as { placement?: string }).placement = 'grid';
    expect(codesOf(doc)).toContain('invalid-placement');
  });

  test('màn free có neo thứ hai hoặc neo không tên A bị từ chối', () => {
    const extra = buildLevelDocument(freeSource);
    extra.pieces[0].anchors.push({ id: 'B', x: 24, y: 16 });
    expect(codesOf(extra)).toContain('free-placement-extra-anchor');
    const renamed = buildLevelDocument(freeSource);
    renamed.pieces[1].anchors[0].id = 'Z';
    expect(codesOf(renamed)).toContain('free-placement-extra-anchor');
  });

  test('màn free có neo lệch lưới bị từ chối', () => {
    const doc = buildLevelDocument(freeSource);
    doc.pieces[0].anchors[0].x = 20;
    expect(codesOf(doc)).toContain('free-placement-off-grid');
  });

  test('màn free không được khai báo distractors', () => {
    const doc = buildLevelDocument(freeSource);
    doc.distractors = [{ pieceId: 'S1', anchorId: 'A', reason: 'thử' }];
    expect(codesOf(doc)).toContain('free-placement-distractors');
  });

  test('allowUnproven phải có lý do', () => {
    const empty = buildLevelDocument(freeSource);
    empty.allowUnproven = { reason: '   ' };
    expect(codesOf(empty)).toContain('invalid-allow-unproven');
    const ok = buildLevelDocument(freeSource);
    ok.allowUnproven = { reason: 'Đã chơi thử, không thấy nghiệm thứ hai' };
    expect(validateLevel(ok).ok).toBe(true);
  });
});

