import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { relative, resolve } from 'node:path';
import type { LevelSource } from './authoring.ts';
import { authorLevel } from './authorLevel.ts';
import type { LevelDocument, ValidationIssue } from './document.ts';
import { compareLevelIds, constNameFromTitle } from './newLevel.ts';
import { serializeLevelSource } from './serializeSource.ts';

export const STUDIO_ID_PATTERN = /^[a-z0-9-]{1,32}$/;

export type SaveStudioOptions = {
  source: LevelSource;
  root: string;
  manifestIds: ReadonlySet<string>;
  sourceIds: ReadonlySet<string>;
};

export type SaveResult =
  | { ok: true; files: string[]; doc: LevelDocument }
  | { ok: false; status: number; error: string; issues?: ValidationIssue[] };

export type DeleteStudioOptions = {
  id: string;
  root: string;
};

export type DeleteResult =
  | { ok: true; deletedFiles: string[] }
  | { ok: false; status: number; error: string };

export type ListStudioOptions = {
  root: string;
};

export type StudioLevelSummary = {
  id: string;
  title: string;
  chapter: number;
  difficultyEstimate: number;
};

function isValidId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (!STUDIO_ID_PATTERN.test(id)) return false;
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return false;
  return true;
}

function resolveStudioPaths(root: string, id: string) {
  const gameNextDir = root;
  const studioDir = resolve(gameNextDir, 'src/content/studio');
  const studioLevelsDir = resolve(studioDir, 'levels');
  const studioReportDir = resolve(root, 'docs/testing/levels/studio');

  const sourcePath = resolve(studioDir, `${id}.ts`);
  const jsonPath = resolve(studioLevelsDir, `${id}.json`);
  const svgPath = resolve(studioReportDir, `${id}.svg`);
  const reportPath = resolve(studioReportDir, `${id}-report.md`);

  return {
    gameNextDir,
    studioDir,
    studioLevelsDir,
    studioReportDir,
    sourcePath,
    jsonPath,
    svgPath,
    reportPath,
  };
}

/**
 * Lưu màn studio vào repo (spec E, ST-05, ST-06).
 * Ghi 4 file: nguồn .ts, json, svg, báo cáo markdown.
 */
export function saveStudioLevel(opts: SaveStudioOptions): SaveResult {
  const { source, root, manifestIds, sourceIds } = opts;

  if (!source || !isValidId(source.id)) {
    return { ok: false, status: 400, error: 'invalid-id' };
  }

  let constName: string;
  try {
    constName = constNameFromTitle(source.title ?? '');
  } catch {
    return { ok: false, status: 400, error: 'invalid-title' };
  }

  if (manifestIds.has(source.id) || sourceIds.has(source.id)) {
    return { ok: false, status: 409, error: 'id-clash-campaign' };
  }

  const paths = resolveStudioPaths(root, source.id);

  // Kiểm tra đường dẫn không thoát khỏi các thư mục đích
  if (
    !paths.sourcePath.startsWith(paths.studioDir) ||
    !paths.jsonPath.startsWith(paths.studioLevelsDir) ||
    !paths.svgPath.startsWith(paths.studioReportDir) ||
    !paths.reportPath.startsWith(paths.studioReportDir)
  ) {
    return { ok: false, status: 400, error: 'invalid-path' };
  }

  const authored = authorLevel(source);
  if (!authored.ok) {
    return {
      ok: false,
      status: 400,
      error: 'validation-failed',
      issues: authored.issues,
    };
  }

  mkdirSync(paths.studioLevelsDir, { recursive: true });
  mkdirSync(paths.studioReportDir, { recursive: true });

  const sourceContent = serializeLevelSource(source, constName);
  writeFileSync(paths.sourcePath, sourceContent, 'utf8');
  writeFileSync(paths.jsonPath, authored.json, 'utf8');
  writeFileSync(paths.svgPath, authored.svg, 'utf8');
  writeFileSync(paths.reportPath, authored.markdown, 'utf8');

  const files = [
    relative(paths.gameNextDir, paths.sourcePath).replace(/\\/g, '/'),
    relative(paths.gameNextDir, paths.jsonPath).replace(/\\/g, '/'),
    relative(paths.gameNextDir, paths.svgPath).replace(/\\/g, '/'),
    relative(paths.gameNextDir, paths.reportPath).replace(/\\/g, '/'),
  ];

  return {
    ok: true,
    files,
    doc: authored.doc,
  };
}

/**
 * Xoá một màn studio khỏi repo (spec E, ST-05, ST-06).
 * Xoá đúng 4 file đã sinh ra.
 */
export function deleteStudioLevel(opts: DeleteStudioOptions): DeleteResult {
  const { id, root } = opts;

  if (!isValidId(id)) {
    return { ok: false, status: 400, error: 'invalid-id' };
  }

  const paths = resolveStudioPaths(root, id);
  const targets = [paths.sourcePath, paths.jsonPath, paths.svgPath, paths.reportPath];

  const deletedFiles: string[] = [];
  for (const target of targets) {
    if (existsSync(target)) {
      rmSync(target, { force: true });
      deletedFiles.push(relative(paths.gameNextDir, target).replace(/\\/g, '/'));
    }
  }

  return { ok: true, deletedFiles };
}

/**
 * Liệt kê danh sách các màn studio có trong thư mục levels (spec E, ST-05, Quyết định 9).
 * Sắp xếp theo compareLevelIds.
 */
export function listStudioLevels(opts: ListStudioOptions): StudioLevelSummary[] {
  const { root } = opts;
  const paths = resolveStudioPaths(root, 'probe');
  const levelsDir = paths.studioLevelsDir;

  if (!existsSync(levelsDir)) {
    return [];
  }

  const files = readdirSync(levelsDir).filter((f) => f.endsWith('.json'));
  const summaries: StudioLevelSummary[] = [];

  for (const file of files) {
    const fullPath = resolve(levelsDir, file);
    try {
      const raw = readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.id === 'string' &&
        typeof parsed.title === 'string' &&
        typeof parsed.chapter === 'number' &&
        typeof parsed.difficultyEstimate === 'number'
      ) {
        summaries.push({
          id: parsed.id,
          title: parsed.title,
          chapter: parsed.chapter,
          difficultyEstimate: parsed.difficultyEstimate,
        });
      }
    } catch (err) {
      console.warn(
        `[studioStore] Bỏ qua file JSON hỏng ${file}: ${(err as Error).message}`
      );
    }
  }

  summaries.sort((a, b) => compareLevelIds(a.id, b.id));
  return summaries;
}
