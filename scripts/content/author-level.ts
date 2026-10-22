/**
 * Sinh dữ liệu màn từ nguồn mô tả trong src/content/sources/.
 *
 *   npm run content:author -- 1-2
 *   npm run content:author -- --all
 *
 * Mỗi màn: dựng LevelDocument, chạy validator, ghi src/content/levels/<id>.json.
 * Ghi thêm docs/testing/levels/<id>.svg và <id>-report.md; thất bại nếu có nghiệm dùng ít mảnh hơn.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLevelDocument, filterDecoys, serializeLevelDocument } from '../../src/content/authoring.ts';
import { renderPreviewSvg, renderReportMarkdown, searchSolutions } from '../../src/content/authoringReport.ts';
import { collectWarnings, scoreDifficulty } from '../../src/content/difficulty.ts';
import type { LevelDocument } from '../../src/content/document.ts';
import { LEVEL_SOURCES } from '../../src/content/sources/index.ts';
import { validateLevel } from '../../src/content/validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEVELS_DIR = resolve(HERE, '../../src/content/levels');
const REPORT_DIR = resolve(HERE, '../../docs/testing/levels');

function authorOne(id: string): boolean {
  const source = LEVEL_SOURCES[id];
  if (!source) {
    console.error(`[author-level] Không có nguồn cho màn ${id}`);
    return false;
  }

  let doc: LevelDocument;
  try {
    doc = buildLevelDocument(source);
  } catch (err) {
    console.error(`[author-level] FAIL ${(err as Error).message}`);
    return false;
  }

  const result = validateLevel(doc);
  if (!result.ok) {
    for (const issue of result.issues) {
      console.error(`[author-level] FAIL ${issue.levelId} ${issue.field}: ${issue.code}`);
    }
    return false;
  }

  const report = searchSolutions(doc);
  const score = scoreDifficulty(doc, report);
  const warnings = collectWarnings(doc, score);
  writeFileSync(resolve(LEVELS_DIR, `${id}.json`), serializeLevelDocument(doc), 'utf8');
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(resolve(REPORT_DIR, `${id}.svg`), renderPreviewSvg(doc), 'utf8');
  const { dropped } = filterDecoys(source);
  writeFileSync(resolve(REPORT_DIR, `${id}-report.md`), renderReportMarkdown(doc, report, dropped, warnings), 'utf8');
  if (dropped.length > 0) {
    console.log(`[author-level] ${id}: bỏ ${dropped.length} neo nhiễu theo KIT-03 (xem ${id}-report.md)`);
  }
  for (const w of warnings) {
    console.warn(`[author-level] CẢNH BÁO ${id}: ${w.code} - ${w.message}`);
  }

  console.log(
    `[author-level] ${id}: ${doc.targetCells.length} ô mục tiêu, ${report.solutionCount} nghiệm, ` +
      `${report.fewerPieceSolutions} nghiệm ít mảnh hơn (điểm độ khó: ${score.score}, raw: ${score.raw.toFixed(4)})`
  );
  if (!report.proven) {
    // Vẫn ghi file (FP-09); chỉ --release mới chặn
    console.warn(
      `[author-level] CẢNH BÁO ${id}: chưa chứng minh được nghiệm duy nhất (vượt giới hạn bộ giải); ` +
        'content:validate --release sẽ chặn nếu nguồn thiếu allowUnproven'
    );
  }
  if (report.fewerPieceSolutions > 0) {
    console.error(`[author-level] FAIL ${id}: có nghiệm dùng ít mảnh hơn dự định`);
    return false;
  }
  console.log(`[author-level] PASS ${id}`);
  return true;
}

const args = process.argv.slice(2);
const ids = args.includes('--all') ? Object.keys(LEVEL_SOURCES) : args;
if (ids.length === 0) {
  console.error('Dùng: npm run content:author -- <id...> | --all');
  process.exit(1);
}
const results = ids.map((id) => authorOne(id));
process.exit(results.every(Boolean) ? 0 : 1);
