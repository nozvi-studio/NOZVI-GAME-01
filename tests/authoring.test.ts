import { describe, expect, test } from 'vitest';
import rawSongTinh from '../src/content/levels/1-1.json';
import { buildLevelDocument, checkSourceGeometry, filterDecoys } from '../src/content/authoring.ts';
import type { LevelSource } from '../src/content/authoring.ts';
import { renderReportMarkdown, searchSolutions } from '../src/content/authoringReport.ts';
import { CROSS, piece } from '../src/content/kit.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { ANCHOR_SOURCES } from './fixtures/anchorLevels.ts';
import { validateLevel } from '../src/content/validate.ts';

// Anchor-mode 1-1 (frozen copy): the live 1-1 is free placement now
const songTinh = ANCHOR_SOURCES['1-1'];

function cloneSource(source: LevelSource): LevelSource {
  return structuredClone(source);
}

describe('buildLevelDocument', () => {
  test('tạo lại 1-1 cho đúng file đã commit', () => {
    expect(buildLevelDocument(LEVEL_SOURCES['1-1'])).toEqual(rawSongTinh);
  });

  test('1-1 v2: mỗi thoi 1.152 ô, mục tiêu 2.304 ô, qua validator', () => {
    const doc = buildLevelDocument(songTinh);
    expect(doc.contentRevision).toBe('song-tinh-v2');
    expect(doc.pieces.map((p) => p.cells.length)).toEqual([1152, 1152]);
    expect(doc.targetCells).toHaveLength(2304);
    expect(validateLevel(doc).ok).toBe(true);
  });

  test('targetCells sắp theo y rồi x, không trùng', () => {
    const cells = buildLevelDocument(songTinh).targetCells;
    for (let i = 1; i < cells.length; i++) {
      const [px, py] = cells[i - 1];
      const [x, y] = cells[i];
      expect(y > py || (y === py && x > px)).toBe(true);
    }
  });

  test('tam giác ghi orientation, vuông và thoi thì không', () => {
    const source: LevelSource = {
      ...cloneSource(songTinh),
      pieces: [
        { id: 'T1', shapeKind: 'triangle', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 56 }] },
        { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 56 }] },
      ],
      sampleSolutions: [
        [
          { pieceId: 'T1', anchorId: 'A', turns: 0 },
          { pieceId: 'S1', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [],
    };
    const doc = buildLevelDocument(source);
    expect(doc.pieces[0].orientation).toBe(2);
    expect('orientation' in doc.pieces[1]).toBe(false);
  });

  test('từ chối neo không phải bội của 8', () => {
    const bad = cloneSource(songTinh);
    bad.pieces[0].anchors[0].x = 17;
    expect(checkSourceGeometry(bad)).toHaveLength(1);
    expect(() => buildLevelDocument(bad)).toThrow(/bội của 8/);
  });

  test('từ chối khung vượt biên bàn', () => {
    const bad = cloneSource(songTinh);
    bad.pieces[1].anchors[0].x = 88;
    expect(() => buildLevelDocument(bad)).toThrow(/vượt biên/);
  });

  test('từ chối nghiệm trỏ tới neo không tồn tại', () => {
    const bad = cloneSource(songTinh);
    bad.sampleSolutions[0][0].anchorId = 'Z';
    expect(() => buildLevelDocument(bad)).toThrow(/không tồn tại/);
  });

  test('từ chối khung không bám lưới theo loại hình', () => {
    const diamond24 = cloneSource(songTinh);
    diamond24.pieces[0].frameSize = 24;
    expect(() => buildLevelDocument(diamond24)).toThrow(/khung 24 không hợp lệ cho diamond/);
    const square12 = cloneSource(songTinh);
    square12.pieces[0] = { ...square12.pieces[0], shapeKind: 'square', frameSize: 12 };
    expect(() => buildLevelDocument(square12)).toThrow(/khung 12 không hợp lệ cho square/);
  });

  test('bình hành ghi orientation, hình tròn thì không', () => {
    const source: LevelSource = {
      ...cloneSource(songTinh),
      pieces: [
        { id: 'P1', shapeKind: 'parallelogram', orientation: 3, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 56 }] },
        { id: 'C1', shapeKind: 'circle', orientation: 0, frameSize: 32, anchors: [{ id: 'A', x: 72, y: 64 }] },
      ],
      sampleSolutions: [
        [
          { pieceId: 'P1', anchorId: 'A', turns: 0 },
          { pieceId: 'C1', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [],
    };
    const doc = buildLevelDocument(source);
    expect(doc.pieces[0].orientation).toBe(3);
    expect('orientation' in doc.pieces[1]).toBe(false);
  });
});

describe('luật neo nhiễu KIT-03', () => {
  /** Ca 3-8: hai hình tròn giống hệt, neo nhiễu ±8 của mỗi cái trùng neo A của cái kia. */
  function twoCircles(): LevelSource {
    return {
      ...cloneSource(songTinh),
      id: 'test-kit03',
      chapter: 2,
      order: 20,
      pieces: [
        piece('C1', 'circle', 32, [96, 32], { decoys: CROSS }),
        piece('C2', 'circle', 32, [104, 32], { decoys: CROSS }),
      ],
      sampleSolutions: [
        [
          { pieceId: 'C1', anchorId: 'A', turns: 0 },
          { pieceId: 'C2', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [
        { pieceId: 'C1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
        { pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' },
        { pieceId: 'C2', anchorId: 'C', reason: 'Lệch trái 8 ô' },
      ],
      ftueSteps: [],
    };
  }

  test('bỏ neo nhiễu trùng neo A của mảnh cùng hình, cùng hướng, cùng khung', () => {
    const source = twoCircles();
    expect(source.pieces[0].anchors[0]).toEqual({ id: 'A', x: 80, y: 16 });
    expect(source.pieces[1].anchors[0]).toEqual({ id: 'A', x: 88, y: 16 });
    const { source: filtered, dropped } = filterDecoys(source);
    expect(dropped).toEqual([
      { pieceId: 'C1', anchorId: 'B', reason: 'clashes-identical-piece' },
      { pieceId: 'C2', anchorId: 'C', reason: 'clashes-identical-piece' },
    ]);
    expect(filtered.pieces[0].anchors.map((a) => a.id)).toEqual(['A', 'C', 'D', 'E']);
    expect(filtered.pieces[1].anchors.map((a) => a.id)).toEqual(['A', 'B', 'D', 'E']);
    // Gây nhiễu trỏ vào neo đã bỏ cũng bị bỏ
    expect(filtered.distractors).toEqual([{ pieceId: 'C1', anchorId: 'D', reason: 'Lệch xuống 8 ô' }]);
    // Không sửa nguồn gốc
    expect(source.pieces[0].anchors).toHaveLength(5);
  });

  test('sau khi lọc chỉ còn một nghiệm; giữ neo trùng hai mảnh giống hệt đổi chỗ vẫn chỉ tính một nghiệm (FP-08)', () => {
    const doc = buildLevelDocument(twoCircles());
    expect(validateLevel(doc).ok).toBe(true);
    expect(searchSolutions(doc).solutionCount).toBe(1);
    expect(searchSolutions(doc).fewerPieceSolutions).toBe(0);

    const unsafe = structuredClone(doc);
    unsafe.pieces[0].anchors.push({ id: 'B', x: 88, y: 16 });
    unsafe.pieces[1].anchors.push({ id: 'C', x: 80, y: 16 });
    expect(searchSolutions(unsafe).solutionCount).toBe(1);
  });

  test('bỏ neo nhiễu vượt biên bàn, giữ neo A', () => {
    const source: LevelSource = {
      ...cloneSource(songTinh),
      pieces: [piece('S1', 'square', 48, [24, 24], { decoys: CROSS })],
      sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
      distractors: [
        { pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' },
        { pieceId: 'S1', anchorId: 'C', reason: 'Lệch trái 8 ô' },
      ],
    };
    const { dropped } = filterDecoys(source);
    expect(dropped).toEqual([
      { pieceId: 'S1', anchorId: 'C', reason: 'out-of-bounds' },
      { pieceId: 'S1', anchorId: 'E', reason: 'out-of-bounds' },
    ]);
    const doc = buildLevelDocument(source);
    expect(doc.pieces[0].anchors.map((a) => a.id)).toEqual(['A', 'B', 'D']);
    expect(doc.distractors).toEqual([{ pieceId: 'S1', anchorId: 'B', reason: 'Lệch phải 8 ô' }]);
  });

  test('neo A vượt biên vẫn bị từ chối, không bị lọc', () => {
    const source: LevelSource = {
      ...cloneSource(songTinh),
      pieces: [piece('S1', 'square', 48, [16, 24])],
      sampleSolutions: [[{ pieceId: 'S1', anchorId: 'A', turns: 0 }]],
      distractors: [],
    };
    expect(filterDecoys(source).dropped).toEqual([]);
    expect(() => buildLevelDocument(source)).toThrow(/vượt biên/);
  });

  test('các màn đã có nguồn không mất neo nào', () => {
    for (const source of Object.values(LEVEL_SOURCES)) {
      expect(filterDecoys(source).dropped).toEqual([]);
    }
  });

  test('báo cáo liệt kê neo đã bỏ; không có neo bỏ thì không thêm mục', () => {
    const source = twoCircles();
    const doc = buildLevelDocument(source);
    const md = renderReportMarkdown(doc, searchSolutions(doc), filterDecoys(source).dropped);
    expect(md).toContain('## Neo nhiễu đã bỏ (KIT-03)');
    expect(md).toContain('| C1 | B | Trùng neo A của mảnh cùng hình, cùng hướng, cùng khung |');
    expect(md).toContain('| C2 | C | Trùng neo A của mảnh cùng hình, cùng hướng, cùng khung |');
    const plain = buildLevelDocument(songTinh);
    expect(renderReportMarkdown(plain, searchSolutions(plain))).not.toContain('Neo nhiễu đã bỏ');
  });
});

describe('vừa bàn tính theo ô thật', () => {
  function sourceWith(piece: LevelSource['pieces'][number], rotationEnabled = false): LevelSource {
    return {
      ...cloneSource(songTinh),
      rotationEnabled,
      pieces: [piece],
      sampleSolutions: [[{ pieceId: piece.id, anchorId: 'A', turns: 0 }]],
      distractors: [],
    };
  }

  const thuyenBuomHull: LevelSource['pieces'][number] = {
    id: 'H1',
    shapeKind: 'triangle',
    orientation: 6,
    frameSize: 64,
    anchors: [{ id: 'A', x: 24, y: 104 }],
  };

  const meoThanTail: LevelSource['pieces'][number] = {
    id: 'T1',
    shapeKind: 'parallelogram',
    orientation: 1,
    frameSize: 48,
    anchors: [{ id: 'A', x: 88, y: 56 }],
  };

  test('mái hướng 6 có khung thò dưới đáy nhưng ô thật trong bàn: nhận', () => {
    expect(checkSourceGeometry(sourceWith(thuyenBuomHull))).toEqual([]);
  });

  test('bình hành hướng 1 có khung thò phải nhưng ô thật trong bàn: nhận', () => {
    expect(checkSourceGeometry(sourceWith(meoThanTail))).toEqual([]);
  });

  test('ô thật vượt biên vẫn bị từ chối', () => {
    const overflow = { ...thuyenBuomHull, orientation: 4 as const };
    expect(checkSourceGeometry(sourceWith(overflow)).join('\n')).toMatch(/vượt biên bàn/);
  });

  test('màn bật xoay vẫn đòi cả hộp khung vừa bàn', () => {
    expect(checkSourceGeometry(sourceWith(thuyenBuomHull, true)).join('\n')).toMatch(
      /vượt biên bàn khi xoay/
    );
  });

  test('neo âm vẫn bị từ chối', () => {
    const negative = { ...meoThanTail, anchors: [{ id: 'A', x: -8, y: 56 }] };
    expect(checkSourceGeometry(sourceWith(negative)).join('\n')).toMatch(/vượt biên bàn/);
  });
});

describe('buildLevelDocument chép chế độ đặt (spec D)', () => {
  test('chép placement và allowUnproven; màn neo không sinh khoá placement', () => {
    const free: LevelSource = {
      ...cloneSource(songTinh),
      id: 'test-free-copy',
      placement: 'free',
      allowUnproven: { reason: 'thử' },
      pieces: cloneSource(songTinh).pieces.map((p) => ({ ...p, anchors: p.anchors.slice(0, 1) })),
      distractors: [],
    };
    const doc = buildLevelDocument(free);
    expect(doc.placement).toBe('free');
    expect(doc.allowUnproven).toEqual({ reason: 'thử' });
    const anchors = buildLevelDocument(cloneSource(songTinh));
    expect('placement' in anchors).toBe(false);
    expect('allowUnproven' in anchors).toBe(false);
  });
});

