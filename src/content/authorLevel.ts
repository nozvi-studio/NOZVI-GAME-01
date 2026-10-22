import {
  buildLevelDocument,
  filterDecoys,
  serializeLevelDocument,
} from './authoring.ts';
import type { DroppedDecoy, LevelSource } from './authoring.ts';
import {
  renderPreviewSvg,
  renderReportMarkdown,
  searchSolutions,
} from './authoringReport.ts';
import type { SolutionReport } from './authoringReport.ts';
import { collectWarnings, scoreDifficulty } from './difficulty.ts';
import type { DifficultyScore, LevelWarning } from './difficulty.ts';
import type { LevelDocument, ValidationIssue } from './document.ts';
import { validateLevel } from './validate.ts';

export type AuthorResult =
  | {
      ok: true;
      doc: LevelDocument;
      report: SolutionReport;
      dropped: DroppedDecoy[];
      score: DifficultyScore;
      warnings: LevelWarning[];
      json: string;
      svg: string;
      markdown: string;
    }
  | {
      ok: false;
      issues: ValidationIssue[];
    };

/**
 * Một đường authoring hoàn chỉnh trong bộ nhớ (spec E, Quyết định 1).
 * Không đọc/ghi ổ đĩa; trả về tài liệu, giải nghiệm, lọc neo nhiễu, điểm độ khó,
 * cảnh báo và các chuỗi nội dung JSON, SVG, markdown.
 */
export function authorLevel(source: LevelSource): AuthorResult {
  let doc: LevelDocument;
  try {
    doc = buildLevelDocument(source);
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          levelId: source?.id ?? 'unknown',
          field: 'source',
          code: (err as Error).message,
        },
      ],
    };
  }

  const validation = validateLevel(doc);
  if (!validation.ok) {
    return {
      ok: false,
      issues: validation.issues,
    };
  }

  const report = searchSolutions(doc);
  const { dropped } = filterDecoys(source);
  const score = scoreDifficulty(doc, report);
  const warnings = collectWarnings(doc, score);
  const json = serializeLevelDocument(doc);
  const svg = renderPreviewSvg(doc);
  const markdown = renderReportMarkdown(doc, report, dropped, warnings);

  return {
    ok: true,
    doc,
    report,
    dropped,
    score,
    warnings,
    json,
    svg,
    markdown,
  };
}
