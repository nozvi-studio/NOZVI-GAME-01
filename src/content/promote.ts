import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { Chapter, Orientation } from '../domain/model.ts';
import type { LevelSource } from './authoring.ts';
import { authorLevel } from './authorLevel.ts';
import type { LevelDocument, ValidationIssue } from './document.ts';
import {
  compareLevelIds,
  constNameFromTitle,
  constNameInSourceIndex,
  registerInSourceIndex,
} from './newLevel.ts';
import { serializeLevelSource } from './serializeSource.ts';
import { STUDIO_ID_PATTERN, deleteStudioLevel } from './studioStore.ts';

import { sourceFromDocument } from './sourceFromDocument.ts';
export { sourceFromDocument } from './sourceFromDocument.ts';
export type { SourceFromDocumentOverride } from './sourceFromDocument.ts';

const CATALOG_IMPORT_LINE = /^import (\w+) from '\.\/levels\/([^']+)\.json';$/;
const CATALOG_ENTRY_LINE = /^ {2}'([^']+)': (\w+),$/;
type CatalogRow = { line: number; id: string; name: string };

/**
 * Thêm import và entry vào catalog.ts theo thứ tự so sánh ID.
 */
export function registerInCatalog(catalogText: string, id: string, varName: string): string {
  const eol = catalogText.includes('\r\n') ? '\r\n' : '\n';
  const lines = catalogText.replace(/\r\n/g, '\n').split('\n');
  const imports: CatalogRow[] = [];
  const entries: CatalogRow[] = [];

  lines.forEach((text, line) => {
    const im = CATALOG_IMPORT_LINE.exec(text);
    if (im) imports.push({ line, id: im[2], name: im[1] });
    const en = CATALOG_ENTRY_LINE.exec(text);
    if (en) entries.push({ line, id: en[1], name: en[2] });
  });

  if (imports.length === 0 || entries.length === 0) {
    throw new Error('catalog.ts không đúng cấu trúc: cần ít nhất một dòng import level và một dòng documents');
  }
  if (imports.some((r) => r.id === id) || entries.some((r) => r.id === id)) {
    throw new Error(`Màn ${id} đã được đăng ký trong catalog.ts`);
  }
  if (imports.some((r) => r.name === varName)) {
    throw new Error(`Tên biến ${varName} đã dùng trong catalog.ts`);
  }

  const entryAt = entries.find((r) => compareLevelIds(id, r.id) < 0)?.line ?? entries[entries.length - 1].line + 1;
  const importAt = imports.find((r) => compareLevelIds(id, r.id) < 0)?.line ?? imports[imports.length - 1].line + 1;

  if (entryAt >= importAt) {
    lines.splice(entryAt, 0, `  '${id}': ${varName},`);
    lines.splice(importAt, 0, `import ${varName} from './levels/${id}.json';`);
  } else {
    lines.splice(importAt, 0, `import ${varName} from './levels/${id}.json';`);
    lines.splice(entryAt, 0, `  '${id}': ${varName},`);
  }

  return lines.join(eol);
}

/** 'thuyen-sao-v1' → 'thuyen-sao-v2'; không có đuôi -v<N> thì thêm '-v2'. */
export function bumpRevision(revision: string): string {
  const m = /^(.*)-v(\d+)$/.exec(revision);
  if (!m) return `${revision}-v2`;
  return `${m[1]}-v${Number(m[2]) + 1}`;
}

export type ManifestUpdateData = {
  id: string;
  title: string;
  chapter: Chapter;
  order: number;
  contentRevision: string;
};

/**
 * Cập nhật dòng của targetId trong manifest.ts từ status: 'planned' sang 'validated'.
 */
export function updateManifestLine(
  manifestText: string,
  entry: ManifestUpdateData,
  expect: { fromStatus?: 'planned' | 'any' } = {}
): string {
  const eol = manifestText.includes('\r\n') ? '\r\n' : '\n';
  const lines = manifestText.replace(/\r\n/g, '\n').split('\n');

  const pattern = new RegExp(`^\\s*\\{\\s*id:\\s*'${entry.id}',`);
  const lineIdx = lines.findIndex((l) => pattern.test(l));

  if (lineIdx === -1) {
    throw new Error(`Không tìm thấy mã ${entry.id} trong manifest.ts`);
  }

  const currentLine = lines[lineIdx];
  if ((expect.fromStatus ?? 'planned') === 'planned') {
    if (!currentLine.includes("'status': 'planned'") && !currentLine.includes("status: 'planned'")) {
      throw new Error(`Màn ${entry.id} không ở trạng thái planned trong manifest.ts`);
    }
  }

  const escapedTitle = entry.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const escapedRev = entry.contentRevision.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  lines[lineIdx] = `  { id: '${entry.id}', title: '${escapedTitle}', chapter: ${entry.chapter}, order: ${entry.order}, contentRevision: '${escapedRev}', status: 'validated', dataPath: 'src/content/levels/${entry.id}.json' },`;

  return lines.join(eol);
}

/**
 * Cập nhật hằng AUTHORED_LEVELS trong tests/content.test.ts (nếu có).
 */
export function updateAuthoredLevels(testText: string, targetId: string): string {
  const match = testText.match(/const AUTHORED_LEVELS = new Set\(\[(.*?)\]\);/s);
  if (!match) {
    return testText;
  }

  const inner = match[1];
  const ids: string[] = [];
  const idRegex = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = idRegex.exec(inner)) !== null) {
    ids.push(m[1]);
  }

  if (!ids.includes(targetId)) {
    ids.push(targetId);
  }
  ids.sort(compareLevelIds);

  const formatted = `const AUTHORED_LEVELS = new Set([${ids.map((id) => `'${id}'`).join(', ')}]);`;
  return testText.replace(match[0], formatted);
}

const SOURCE_IMPORT_LINE = "import type { LevelSource } from '../authoring.ts';";

/**
 * Giữ lại khối chú thích viết tay nằm giữa dòng import và `export const`
 * của file nguồn cũ. Bản sinh từ serializeLevelSource không có khối này,
 * mà nó thường chứa lý do thiết kế của màn (ví dụ 1-6 giải thích quy tắc ô
 * biên chung). Thuần văn bản: chú thích có thể lạc hậu so với nội dung mới,
 * báo cáo promote nhắc người duyệt đọc lại.
 */
export function preserveHeaderComment(oldText: string, newText: string): string {
  const oldImport = oldText.indexOf(SOURCE_IMPORT_LINE);
  const oldExport = oldText.indexOf('export const');
  if (oldImport === -1 || oldExport === -1 || oldExport < oldImport) return newText;

  const between = oldText.slice(oldImport + SOURCE_IMPORT_LINE.length, oldExport).trim();
  if (between === '') return newText;

  const newExport = newText.indexOf('export const');
  if (newExport === -1) return newText;

  const eol = newText.includes('\r\n') ? '\r\n' : '\n';
  const head = newText.slice(0, newExport).replace(/\s+$/, '');
  return `${head}${eol}${eol}${between}${eol}${newText.slice(newExport)}`;
}

export type PromoteOptions = {
  studioId: string;
  targetId: string;
  root: string;
  overwrite?: boolean;
};

export type PromoteResult =
  | {
      ok: true;
      targetId: string;
      writtenFiles: string[];
      deletedFiles: string[];
      preservedComment?: boolean;
    }
  | {
      ok: false;
      error: string;
      issues?: ValidationIssue[];
    };

/**
 * Đưa một màn studio vào campaign:
 * 1. Đọc JSON studio và kiểm tra targetId trong manifest
 * 2. Dựng LevelSource mới với id, chapter, order của target
 * 3. Chạy authorLevel kiểm tra đúng 1 nghiệm
 * 4. Ghi file nguồn, đăng ký index.ts, ghi JSON, SVG, markdown report
 * 5. Cập nhật catalog.ts, manifest.ts và tests/content.test.ts
 * 6. Xoá bản studio
 */
export function promoteStudioLevel(opts: PromoteOptions): PromoteResult {
  if (!STUDIO_ID_PATTERN.test(opts.studioId) || opts.studioId.includes('/') || opts.studioId.includes('\\')) {
    return { ok: false, error: `invalid-studio-id:${opts.studioId}` };
  }

  const gameNextDir = opts.root;
  const studioJsonPath = resolve(gameNextDir, 'src/content/studio/levels', `${opts.studioId}.json`);

  if (!existsSync(studioJsonPath)) {
    return { ok: false, error: `studio-not-found:${opts.studioId}` };
  }

  let studioDoc: LevelDocument;
  try {
    studioDoc = JSON.parse(readFileSync(studioJsonPath, 'utf8'));
  } catch (err) {
    return { ok: false, error: `corrupt-studio-json: ${(err as Error).message}` };
  }

  const manifestPath = resolve(gameNextDir, 'src/content/manifest.ts');
  if (!existsSync(manifestPath)) {
    return { ok: false, error: 'manifest-not-found' };
  }

  const manifestText = readFileSync(manifestPath, 'utf8');
  const targetMatch = manifestText.match(
    new RegExp(
      `^\\s*\\{\\s*id:\\s*'${opts.targetId}',\\s*title:\\s*'([^']*)',\\s*chapter:\\s*([1-4]),\\s*order:\\s*(\\d+),\\s*contentRevision:\\s*'([^']*)',\\s*status:\\s*'([^']*)'(?:,\\s*dataPath:\\s*'[^']*')?\\s*\\},?$`,
      'm'
    )
  );

  if (!targetMatch) {
    return { ok: false, error: `target-not-in-manifest:${opts.targetId}` };
  }

  const [, , chapterStr, orderStr, , status] = targetMatch;
  const overwrite = opts.overwrite === true;
  if (!overwrite && status !== 'planned') {
    return { ok: false, error: `target-not-planned:${opts.targetId} (status is ${status})` };
  }
  if (overwrite && status === 'planned') {
    return { ok: false, error: `overwrite-on-planned:${opts.targetId} (dùng chế độ thường)` };
  }

  const targetChapter = Number(chapterStr) as Chapter;
  const targetOrder = Number(orderStr);

  const newSource = sourceFromDocument(studioDoc, {
    id: opts.targetId,
    chapter: targetChapter,
    order: targetOrder,
  });

  const currentRevision = targetMatch[4];
  if (overwrite) {
    newSource.contentRevision = bumpRevision(currentRevision);
  }

  const authorResult = authorLevel(newSource);
  if (!authorResult.ok) {
    return {
      ok: false,
      error: `authoring-validation-failed: ${authorResult.issues?.map((i) => `${i.field}:${i.code}`).join(', ')}`,
      issues: authorResult.issues,
    };
  }

  if (authorResult.report?.solutionCount !== 1) {
    return {
      ok: false,
      error: `expected-single-solution (found ${authorResult.report?.solutionCount ?? 0})`,
    };
  }

  if ((authorResult.report?.fewerPieceSolutions ?? 0) > 0) {
    return {
      ok: false,
      error: `fewer-piece-solutions (found ${authorResult.report?.fewerPieceSolutions})`,
    };
  }

  const writtenFiles: string[] = [];

  const indexPath = resolve(gameNextDir, 'src/content/sources/index.ts');
  const indexText = readFileSync(indexPath, 'utf8');
  const registeredName = constNameInSourceIndex(indexText, opts.targetId);

  // 1. src/content/sources/<targetId>.ts
  // A registered level keeps the const name index.ts already imports. The
  // title may change; the const name may not, because index.ts — and through
  // it the whole build — points at that name.
  const constName = registeredName ?? constNameFromTitle(newSource.title);
  let sourceText = serializeLevelSource(newSource, constName);
  const sourceFilePath = resolve(gameNextDir, 'src/content/sources', `${opts.targetId}.ts`);
  let preservedComment = false;
  if (overwrite && existsSync(sourceFilePath)) {
    const oldText = readFileSync(sourceFilePath, 'utf8');
    const merged = preserveHeaderComment(oldText, sourceText);
    preservedComment = merged !== sourceText;
    sourceText = merged;
  }
  writeFileSync(sourceFilePath, sourceText, 'utf8');
  writtenFiles.push(relative(opts.root, sourceFilePath).replace(/\\/g, '/'));

  // 2. src/content/sources/index.ts
  // Already registered: leave it alone, since step 1 took the name from here.
  // Not registered (a new level, or an overwrite of one that never reached
  // the index): register it now, or the source file nobody imports is orphaned.
  if (registeredName === null) {
    const updatedIndexText = registerInSourceIndex(indexText, opts.targetId, constName);
    writeFileSync(indexPath, updatedIndexText, 'utf8');
    writtenFiles.push(relative(opts.root, indexPath).replace(/\\/g, '/'));
  }

  // 3. src/content/levels/<targetId>.json
  const levelJsonPath = resolve(gameNextDir, 'src/content/levels', `${opts.targetId}.json`);
  writeFileSync(levelJsonPath, authorResult.json!, 'utf8');
  writtenFiles.push(relative(opts.root, levelJsonPath).replace(/\\/g, '/'));

  // 4. docs/testing/levels/<targetId>.svg
  const svgPath = resolve(opts.root, 'docs/testing/levels', `${opts.targetId}.svg`);
  writeFileSync(svgPath, authorResult.svg!, 'utf8');
  writtenFiles.push(relative(opts.root, svgPath).replace(/\\/g, '/'));

  // 5. docs/testing/levels/<targetId>-report.md
  const reportPath = resolve(opts.root, 'docs/testing/levels', `${opts.targetId}-report.md`);
  writeFileSync(reportPath, authorResult.markdown!, 'utf8');
  writtenFiles.push(relative(opts.root, reportPath).replace(/\\/g, '/'));

  // 6. catalog.ts
  if (!overwrite) {
    const catalogPath = resolve(gameNextDir, 'src/content/catalog.ts');
    const catalogText = readFileSync(catalogPath, 'utf8');
    const updatedCatalogText = registerInCatalog(catalogText, opts.targetId, constName);
    writeFileSync(catalogPath, updatedCatalogText, 'utf8');
    writtenFiles.push(relative(opts.root, catalogPath).replace(/\\/g, '/'));
  }

  // 7. manifest.ts
  const updatedManifestText = updateManifestLine(
    manifestText,
    {
      id: opts.targetId,
      title: newSource.title,
      chapter: targetChapter,
      order: targetOrder,
      contentRevision: newSource.contentRevision,
    },
    { fromStatus: overwrite ? 'any' : 'planned' }
  );
  writeFileSync(manifestPath, updatedManifestText, 'utf8');
  writtenFiles.push(relative(opts.root, manifestPath).replace(/\\/g, '/'));

  // 8. tests/content.test.ts (nếu có)
  const contentTestPath = resolve(gameNextDir, 'tests/content.test.ts');
  if (existsSync(contentTestPath)) {
    const testText = readFileSync(contentTestPath, 'utf8');
    const updatedTestText = updateAuthoredLevels(testText, opts.targetId);
    if (updatedTestText !== testText) {
      writeFileSync(contentTestPath, updatedTestText, 'utf8');
      writtenFiles.push(relative(opts.root, contentTestPath).replace(/\\/g, '/'));
    }
  }

  // 9. Xoá bản studio
  const deleteResult = deleteStudioLevel({ id: opts.studioId, root: opts.root });
  const deletedFiles = deleteResult.ok ? deleteResult.deletedFiles : [];

  return {
    ok: true,
    targetId: opts.targetId,
    writtenFiles,
    deletedFiles,
    preservedComment,
  };
}
