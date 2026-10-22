import { GRID_HEIGHT, GRID_WIDTH, TOTAL_CELLS } from '../domain/model.ts';
import { shapePolygon } from '../domain/shapes.ts';
import type { DroppedDecoy } from './authoring.ts';
import type { LevelWarning } from './difficulty.ts';
import type { LevelDocument } from './document.ts';
import { NO_OVERLAP_CHAPTERS } from './chapters.ts';
import { solveLevel } from './solver.ts';

export type SolutionReport = {
  solutionCount: number;
  fewerPieceSolutions: number;
  /** false khi bộ giải dừng vì vượt giới hạn (FP-09) */
  proven: boolean;
  /** Số tư thế trên bàn của từng mảnh (không tính khay) */
  poseCounts: number[];
  elapsedMs: number;
  distractors: Array<{
    pieceId: string;
    anchorId: string | null;
    reason: string;
    changedCells: number | null;
  }>;
};

function targetMaskOf(doc: LevelDocument): Uint8Array {
  const mask = new Uint8Array(TOTAL_CELLS);
  for (const [x, y] of doc.targetCells) mask[y * GRID_WIDTH + x] = 1;
  return mask;
}

/** choice[i] là chỉ số neo của mảnh i, hoặc -1 khi mảnh nằm ở khay. */
function maskFor(doc: LevelDocument, choice: readonly number[]): Uint8Array {
  const mask = new Uint8Array(TOTAL_CELLS);
  doc.pieces.forEach((piece, i) => {
    const anchorIndex = choice[i];
    if (anchorIndex < 0) return;
    const anchor = piece.anchors[anchorIndex];
    for (const [cx, cy] of piece.cells) {
      mask[(anchor.y + cy) * GRID_WIDTH + anchor.x + cx] ^= 1;
    }
  });
  return mask;
}

function diffCount(a: Uint8Array, b: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) count++;
  return count;
}

/**
 * Đếm nghiệm bằng bộ giải chung (spec D, FP-10): màn neo duyệt "neo của mảnh
 * + khay", màn free duyệt mọi giao điểm lưới. Hai mảnh giống hệt đổi chỗ chỉ
 * tính một nghiệm. Số ô đổi của từng tư thế gây nhiễu vẫn tính như trước.
 */
export function searchSolutions(doc: LevelDocument): SolutionReport {
  const target = targetMaskOf(doc);
  const solved = solveLevel(doc, { tilingOnly: NO_OVERLAP_CHAPTERS.includes(doc.chapter) });

  const base = doc.pieces.map((piece) => {
    const step = doc.sampleSolutions[0]?.find((s) => s.pieceId === piece.id);
    return step ? piece.anchors.findIndex((a) => a.id === step.anchorId) : -1;
  });

  const distractors = doc.distractors.map((d) => {
    const pieceIndex = doc.pieces.findIndex((p) => p.id === d.pieceId);
    const anchorIndex =
      pieceIndex >= 0 && d.anchorId
        ? doc.pieces[pieceIndex].anchors.findIndex((a) => a.id === d.anchorId)
        : -1;
    if (pieceIndex < 0 || anchorIndex < 0) {
      return { pieceId: d.pieceId, anchorId: d.anchorId ?? null, reason: d.reason, changedCells: null };
    }
    const choice = base.slice();
    choice[pieceIndex] = anchorIndex;
    return {
      pieceId: d.pieceId,
      anchorId: d.anchorId ?? null,
      reason: d.reason,
      changedCells: diffCount(maskFor(doc, choice), target),
    };
  });

  return {
    solutionCount: solved.solutionCount,
    fewerPieceSolutions: solved.fewerPieceSolutions,
    proven: solved.proven,
    poseCounts: solved.poseCounts,
    elapsedMs: solved.elapsedMs,
    distractors,
  };
}

/** Lý do chặn phát hành (FP-09): chưa chứng minh nghiệm duy nhất và người review chưa ghi allowUnproven. */
export function releaseBlocker(doc: LevelDocument, report: SolutionReport): string | null {
  return !report.proven && doc.allowUnproven === undefined ? 'unproven-unique-solution' : null;
}

const DROP_REASON_TEXT: Readonly<Record<DroppedDecoy['reason'], string>> = {
  'out-of-bounds': 'Vượt biên bàn',
  'clashes-identical-piece': 'Trùng neo A của mảnh cùng hình, cùng hướng, cùng khung',
};

export function renderReportMarkdown(
  doc: LevelDocument,
  report: SolutionReport,
  dropped: readonly DroppedDecoy[] = [],
  warnings: readonly LevelWarning[] = []
): string {
  // Chỉ thêm mục khi có neo bị bỏ, để báo cáo các màn cũ không đổi
  const droppedLines =
    dropped.length === 0
      ? []
      : [
          '## Neo nhiễu đã bỏ (KIT-03)',
          '',
          '| Mảnh | Neo | Lý do |',
          '|---|---|---|',
          ...dropped.map((d) => `| ${d.pieceId} | ${d.anchorId} | ${DROP_REASON_TEXT[d.reason]} |`),
          '',
        ];
  // Chỉ thêm mục khi có cảnh báo (DF-03)
  const warningLines =
    warnings.length === 0
      ? []
      : [
          '## Cảnh báo',
          '',
          ...warnings.map((w) => `- \`${w.code}\`: ${w.message}`),
          '',
        ];
  const lines = [
    `# ${doc.id}${doc.title && doc.title !== doc.id ? ` ${doc.title}` : ''}`,
    '',
    `- Revision: \`${doc.contentRevision}\``,
    ...(doc.learningObjective ? [`- Mục tiêu học: ${doc.learningObjective}`] : []),
    `- Số mảnh: ${doc.pieces.length}; số ô mục tiêu: ${doc.targetCells.length}`,
    `- Số nghiệm: ${report.solutionCount}`,
    `- Nghiệm dùng ít mảnh hơn: ${report.fewerPieceSolutions}`,
    ...(report.proven
      ? []
      : [
          '- **Chưa chứng minh được nghiệm duy nhất** (vượt giới hạn bộ giải); phát hành cần `allowUnproven` kèm lý do.',
        ]),
    ...(doc.placement === 'free'
      ? [
          '- Chế độ đặt: tự do (hít vào mọi giao điểm lưới)',
          `- Số tư thế mỗi mảnh: ${doc.pieces.map((p, i) => `${p.id} ${report.poseCounts[i]}`).join(', ')}`,
          `- Thời gian giải: ${Math.round(report.elapsedMs)} ms`,
          `- Đã chứng minh: ${report.proven ? 'có' : 'không'}`,
        ]
      : []),
    '',
    ...warningLines,
    '## Tư thế gây nhiễu',
    '',
    '| Mảnh | Neo | Lý do | Số ô đổi so với mục tiêu |',
    '|---|---|---|---|',
    ...report.distractors.map(
      (d) => `| ${d.pieceId} | ${d.anchorId ?? '—'} | ${d.reason} | ${d.changedCells ?? '—'} |`
    ),
    '',
    ...droppedLines,
    `Ảnh xem trước: \`${doc.id}.svg\`. Sinh bằng \`npm run content:author -- ${doc.id}\`; không sửa tay.`,
    '',
  ];
  return lines.join('\n');
}

const SCALE = 4;
const PIECE_COLORS = ['#FFC857', '#7EE0A1', '#FF8FA3', '#8FB8FF'];

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function polygonPoints(doc: LevelDocument, pieceIndex: number, ax: number, ay: number): string {
  const piece = doc.pieces[pieceIndex];
  return shapePolygon(piece.shapeKind, piece.orientation ?? 0, piece.frameSize)
    .map((v) => `${(ax + v.x) * SCALE},${(ay + v.y) * SCALE}`)
    .join(' ');
}

/** Đường bao mục tiêu: mỗi hàng ô là các đoạn chạy liền nhau. */
function targetPath(doc: LevelDocument): string {
  const mask = targetMaskOf(doc);
  const parts: string[] = [];
  for (let y = 0; y < GRID_HEIGHT; y++) {
    let x = 0;
    while (x < GRID_WIDTH) {
      if (!mask[y * GRID_WIDTH + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < GRID_WIDTH && mask[y * GRID_WIDTH + x]) x++;
      parts.push(`M${start * SCALE} ${y * SCALE}h${(x - start) * SCALE}v${SCALE}h${-(x - start) * SCALE}z`);
    }
  }
  return parts.join('');
}

export function renderPreviewSvg(doc: LevelDocument): string {
  const w = GRID_WIDTH * SCALE;
  const h = GRID_HEIGHT * SCALE;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + 40}" viewBox="0 0 ${w} ${h + 40}">`);
  out.push(`<rect width="${w}" height="${h + 40}" fill="#101a4f"/>`);

  // Lưới hiển thị (8 ô) và module (24 ô)
  for (let x = 0; x <= GRID_WIDTH; x += 8) {
    const color = x % 24 === 0 ? '#3b56b8' : '#22336f';
    out.push(`<line x1="${x * SCALE}" y1="0" x2="${x * SCALE}" y2="${h}" stroke="${color}" stroke-width="1"/>`);
  }
  for (let y = 0; y <= GRID_HEIGHT; y += 8) {
    const color = y % 24 === 0 ? '#3b56b8' : '#22336f';
    out.push(`<line x1="0" y1="${y * SCALE}" x2="${w}" y2="${y * SCALE}" stroke="${color}" stroke-width="1"/>`);
  }

  out.push(`<path d="${targetPath(doc)}" fill="#BFE3FF" fill-opacity="0.35"/>`);

  // Nghiệm mẫu: mỗi mảnh một màu viền
  for (const step of doc.sampleSolutions[0] ?? []) {
    const index = doc.pieces.findIndex((p) => p.id === step.pieceId);
    const anchor = doc.pieces[index]?.anchors.find((a) => a.id === step.anchorId);
    if (index < 0 || !anchor) continue;
    out.push(
      `<polygon data-piece="${step.pieceId}" points="${polygonPoints(doc, index, anchor.x, anchor.y)}" fill="none" stroke="${PIECE_COLORS[index % PIECE_COLORS.length]}" stroke-width="3"/>`
    );
  }

  // Tư thế gây nhiễu: nét đứt cùng màu mảnh
  for (const d of doc.distractors) {
    const index = doc.pieces.findIndex((p) => p.id === d.pieceId);
    const anchor = doc.pieces[index]?.anchors.find((a) => a.id === d.anchorId);
    if (index < 0 || !anchor) continue;
    out.push(
      `<polygon points="${polygonPoints(doc, index, anchor.x, anchor.y)}" fill="none" stroke="${PIECE_COLORS[index % PIECE_COLORS.length]}" stroke-width="2" stroke-dasharray="8 6" stroke-opacity="0.8"/>`
    );
  }

  // Neo: chấm tại gốc khung, kèm nhãn
  doc.pieces.forEach((piece, index) => {
    for (const anchor of piece.anchors) {
      // Màn free: mọi giao điểm đã là neo nhiễu nên chỉ vẽ neo A (vị trí đúng)
      if (doc.placement === 'free' && anchor.id !== 'A') continue;
      const cx = anchor.x * SCALE;
      const cy = anchor.y * SCALE;
      out.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${PIECE_COLORS[index % PIECE_COLORS.length]}"/>`);
      out.push(
        `<text x="${cx + 6}" y="${cy + 14}" fill="#DDF2FF" font-family="sans-serif" font-size="12">${escapeXml(`${piece.id}.${anchor.id}`)}</text>`
      );
    }
  });

  out.push(
    `<text x="8" y="${h + 26}" fill="#DDF2FF" font-family="sans-serif" font-size="16">${escapeXml(`${doc.id} · ${doc.title} · ${doc.contentRevision}`)}</text>`
  );
  out.push('</svg>');
  return out.join('\n') + '\n';
}
