/** Tạo nguồn màn mới bằng cách clone một màn có sẵn hoặc file mẫu. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManifestEntry } from '../../src/content/document.ts';
import { campaignManifest } from '../../src/content/manifest.ts';
import { constNameFromTitle, createLevelSourceText, registerInSourceIndex, slugFromTitle } from '../../src/content/newLevel.ts';

export const TEMPLATE_FILE = '_template.ts';

export type NewLevelOptions = {
  id: string;
  from?: string;
  title?: string;
  sourcesDir: string;
  studioDir: string;
  manifest: ReadonlyArray<Pick<ManifestEntry, 'id' | 'title' | 'order'>>;
};

export type NewLevelResult = { filePath: string; constName: string; nextCommand: string };

export function createNewLevel(opts: NewLevelOptions): NewLevelResult {
  const { id, sourcesDir, studioDir } = opts;
  if (!/^[0-9a-z]+(?:-[0-9a-z]+)*$/.test(id)) throw new Error(`Mã màn "${id}" không hợp lệ: chỉ dùng chữ thường, số và gạch ngang, ví dụ 3-11`);
  for (const dir of [sourcesDir, studioDir]) {
    const existing = join(dir, `${id}.ts`);
    if (existsSync(existing)) throw new Error(`Màn ${id} đã có nguồn tại ${existing}`);
  }

  let fromPath = join(sourcesDir, TEMPLATE_FILE);
  if (opts.from !== undefined) {
    const candidates = [join(sourcesDir, `${opts.from}.ts`), join(studioDir, `${opts.from}.ts`)];
    const found = candidates.find((p) => existsSync(p));
    if (!found) throw new Error(`Không tìm thấy nguồn của màn ${opts.from} trong sources/ hoặc studio/`);
    fromPath = found;
  }
  const fromText = readFileSync(fromPath, 'utf8');
  const constMatch = /^export const (\w+): LevelSource =/m.exec(fromText);
  if (!constMatch) throw new Error(`Không tìm thấy dòng "export const <tên>: LevelSource =" trong ${fromPath}`);

  const entry = opts.manifest.find((e) => e.id === id);
  const title = opts.title ?? entry?.title ?? `Màn ${id}`;
  const order = entry?.order ?? Math.max(0, ...opts.manifest.map((e) => e.order)) + 1;
  const constName = constNameFromTitle(title);
  const indexPath = join(sourcesDir, 'index.ts');
  const indexText = registerInSourceIndex(readFileSync(indexPath, 'utf8'), id, constName);
  const sourceText = createLevelSourceText({ id, order, title, fromText, fromConstName: constMatch[1], slug: slugFromTitle(title) });

  const filePath = join(sourcesDir, `${id}.ts`);
  writeFileSync(filePath, sourceText, 'utf8');
  writeFileSync(indexPath, indexText, 'utf8');
  return { filePath, constName, nextCommand: `npm run content:author -- ${id}` };
}

function parseArgs(argv: readonly string[]): { id?: string; from?: string; title?: string } {
  const parsed: { id?: string; from?: string; title?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from' || arg === '--title') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`Thiếu giá trị sau ${arg}`);
      if (arg === '--from') parsed.from = value;
      else parsed.title = value;
      i++;
    } else if (arg.startsWith('--')) throw new Error(`Tham số không hỗ trợ: ${arg}`);
    else if (parsed.id === undefined) parsed.id = arg;
    else throw new Error(`Chỉ nhận một mã màn, thừa: ${arg}`);
  }
  return parsed;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (isMainModule()) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.id) {
      console.error('Dùng: npm run content:new -- <id> [--from <id-nguồn>] [--title "<tên>"]');
      process.exit(1);
    }
    const result = createNewLevel({
      id: args.id,
      from: args.from,
      title: args.title,
      sourcesDir: resolve(HERE, '../../src/content/sources'),
      studioDir: resolve(HERE, '../../src/content/studio'),
      manifest: campaignManifest,
    });
    console.log(`[new-level] Đã tạo ${relative(process.cwd(), result.filePath)} (hằng ${result.constName}) và đăng ký vào src/content/sources/index.ts`);
    console.log(`[new-level] Bước tiếp theo: ${result.nextCommand}`);
  } catch (err) {
    console.error(`[new-level] FAIL ${(err as Error).message}`);
    process.exit(1);
  }
}
