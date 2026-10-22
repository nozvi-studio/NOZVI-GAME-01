import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import type { LevelSource } from '../src/content/authoring.ts';
import { DEV_LEVEL_DOCUMENTS } from '../src/content/devLevels.ts';
import type { LevelDocument } from '../src/content/document.ts';
import {
  releaseBlocker,
  renderPreviewSvg,
  renderReportMarkdown,
  searchSolutions,
} from '../src/content/authoringReport.ts';
import { FREE_DEMO_SOURCE } from '../src/content/devLevels.ts';
import { ANCHOR_SOURCES } from './fixtures/anchorLevels.ts';

const songTinh = buildLevelDocument(ANCHOR_SOURCES['1-1']);

describe('searchSolutions', () => {
  test('1-1 có đúng một nghiệm, không nghiệm ít mảnh, mỗi neo B đổi 1.280 ô', () => {
    const report = searchSolutions(songTinh);
    expect(report.solutionCount).toBe(1);
    expect(report.fewerPieceSolutions).toBe(0);
    expect(report.distractors.map((d) => d.changedCells)).toEqual([1280, 1280]);
    expect(report.proven).toBe(true);
  });

  test('hai mảnh giống hệt đổi chỗ cho nhau chỉ tính một nghiệm (FP-08)', () => {
    const twins: LevelSource = {
      ...structuredClone(ANCHOR_SOURCES['1-1']),
      id: 'test-twins',
      pieces: [
        { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 56 }] },
        { id: 'S2', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 56 }] },
      ],
      sampleSolutions: [
        [
          { pieceId: 'S1', anchorId: 'A', turns: 0 },
          { pieceId: 'S2', anchorId: 'A', turns: 0 },
        ],
      ],
      distractors: [],
    };
    const doc = buildLevelDocument(twins);
    // Thêm neo đổi chỗ sau khi dựng, để không phụ thuộc luật lọc neo nhiễu KIT-03 của plan B
    doc.pieces[0].anchors.push({ id: 'B', x: 64, y: 56 });
    doc.pieces[1].anchors.push({ id: 'B', x: 16, y: 56 });
    expect(searchSolutions(doc).solutionCount).toBe(1);
  });

  test('báo nghiệm ít mảnh hơn khi có mảnh thừa không cần dùng', () => {
    // X1 không nằm trong nghiệm mẫu nên target chỉ gồm D1 + D2; nghiệm duy nhất để X1 ở khay
    const extra: LevelSource = {
      ...structuredClone(ANCHOR_SOURCES['1-1']),
      id: 'test-extra',
      pieces: [
        ...structuredClone(ANCHOR_SOURCES['1-1'].pieces),
        { id: 'X1', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 40, y: 104 }] },
      ],
      distractors: [],
    };
    const report = searchSolutions(buildLevelDocument(extra));
    expect(report.solutionCount).toBe(1);
    expect(report.fewerPieceSolutions).toBe(1);
  });
});

describe('renderPreviewSvg và renderReportMarkdown', () => {
  test('SVG có đủ đa giác nghiệm và tư thế gây nhiễu', () => {
    const svg = renderPreviewSvg(songTinh);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('data-piece="D1"');
    expect(svg).toContain('data-piece="D2"');
    expect(svg.match(/stroke-dasharray/g)).toHaveLength(2);
    expect(svg).toContain('D1.A');
    expect(svg).toContain('D2.B');
  });

  test('báo cáo markdown ghi số nghiệm và số ô đổi của từng gây nhiễu', () => {
    const md = renderReportMarkdown(songTinh, searchSolutions(songTinh));
    expect(md).toContain('# 1-1 Song Tinh');
    expect(md).toContain('Số nghiệm: 1');
    expect(md).toContain('Nghiệm dùng ít mảnh hơn: 0');
    expect(md).toContain('| D1 | B | Lệch trục ngang | 1280 |');
  });
});

describe('ảnh xem trước vẽ được hai hình mới', () => {
  test('SVG của dev-shapes-v2 có đa giác 32 đỉnh cho hình tròn và 4 đỉnh cho bình hành', () => {
    const svg = renderPreviewSvg(DEV_LEVEL_DOCUMENTS['dev-shapes-v2'] as LevelDocument);
    const circle = svg.match(/<polygon data-piece="C1" points="([^"]+)"/)!;
    expect(circle[1].trim().split(' ')).toHaveLength(32);
    const para = svg.match(/<polygon data-piece="P1" points="([^"]+)"/)!;
    expect(para[1].trim().split(' ')).toHaveLength(4);
  });
});

describe('Báo cáo và cổng phát hành cho màn đặt tự do (spec D)', () => {
  const demo = buildLevelDocument(FREE_DEMO_SOURCE);

  test('báo cáo màn free ghi số tư thế, thời gian giải và đã chứng minh', () => {
    const report = searchSolutions(demo);
    expect(report).toMatchObject({ solutionCount: 1, fewerPieceSolutions: 0, proven: true });
    const md = renderReportMarkdown(demo, report);
    expect(md).toContain('- Chế độ đặt: tự do (hít vào mọi giao điểm lưới)');
    expect(md).toContain('- Số tư thế mỗi mảnh: S1 165, D1 165, T1 165, T2 198');
    expect(md).toMatch(/- Thời gian giải: \d+ ms/);
    expect(md).toContain('- Đã chứng minh: có');
    expect(md).not.toContain('Chưa chứng minh');
  });

  test('báo cáo chưa chứng minh có dòng cảnh báo; màn neo không có khối đặt tự do', () => {
    const md = renderReportMarkdown(demo, { ...searchSolutions(demo), proven: false });
    expect(md).toContain('**Chưa chứng minh được nghiệm duy nhất**');
    const anchors = renderReportMarkdown(songTinh, searchSolutions(songTinh));
    expect(anchors).not.toContain('Chế độ đặt');
    expect(anchors).not.toContain('Chưa chứng minh');
  });

  test('SVG màn free chỉ vẽ neo A, không có nét đứt gây nhiễu', () => {
    const svg = renderPreviewSvg(demo);
    expect(svg.match(/<circle /g)).toHaveLength(4);
    expect(svg).toContain('T2.A');
    expect(svg).not.toContain('stroke-dasharray');
  });

  test('releaseBlocker chặn màn chưa chứng minh trừ khi có allowUnproven', () => {
    const report = searchSolutions(demo);
    expect(releaseBlocker(demo, report)).toBeNull();
    expect(releaseBlocker(demo, { ...report, proven: false })).toBe('unproven-unique-solution');
    const allowed = { ...demo, allowUnproven: { reason: 'Đã chơi thử' } };
    expect(releaseBlocker(allowed, { ...report, proven: false })).toBeNull();
  });

  test('renderReportMarkdown in mục Cảnh báo khi có cảnh báo và ẩn khi rỗng', () => {
    const report = searchSolutions(songTinh);
    const withoutWarnings = renderReportMarkdown(songTinh, report, []);
    expect(withoutWarnings).not.toContain('## Cảnh báo');

    const withWarnings = renderReportMarkdown(songTinh, report, [], [
      { code: 'difficulty-mismatch', message: 'Độ khó lệch quá 1' },
    ]);
    expect(withWarnings).toContain('## Cảnh báo');
    expect(withWarnings).toContain('- `difficulty-mismatch`: Độ khó lệch quá 1');
  });
});

