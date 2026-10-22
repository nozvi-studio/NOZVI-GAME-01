/**
 * Phần thuần của lệnh `npm run content:new`: đặt tên, sửa trường cấp màn và
 * đăng ký vào `sources/index.ts`. Đọc/ghi file nằm ở `scripts/content/new-level.ts`.
 */

/** Bỏ dấu tiếng Việt: "Ngọn Nến" → "Ngon Nen". */
export function stripVietnamese(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function titleWords(title: string): string[] {
  return stripVietnamese(title).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Tên hằng xuất của nguồn: "Thuyền Buồm Hoàng Hôn" → "thuyenBuomHoangHon". */
export function constNameFromTitle(title: string): string {
  const words = titleWords(title);
  if (words.length === 0) throw new Error(`Tên màn "${title}" không có chữ cái hay chữ số nào để đặt tên hằng`);
  const name = words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
  return /^[0-9]/.test(name) ? `level${name[0].toUpperCase()}${name.slice(1)}` : name;
}

/** Slug không dấu cho contentRevision: "Mèo Thần" → "meo-than". */
export function slugFromTitle(title: string): string {
  return titleWords(title).join('-');
}

/** So id màn theo số từng phần: "3-9" < "3-10" < "4-1". */
export function compareLevelIds(a: string, b: string): number {
  const pa = a.split('-');
  const pb = b.split('-');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return 0;
}

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function replaceOnce(text: string, pattern: RegExp, replacement: string, field: string): string {
  const count = text.match(new RegExp(pattern.source, 'gm'))?.length ?? 0;
  if (count !== 1) throw new Error(`Nguồn gốc phải có đúng một dòng ${field} ở cấp màn, tìm thấy ${count}`);
  return text.replace(pattern, () => replacement);
}

export type CreateLevelSourceOptions = {
  id: string; order: number; title: string; fromText: string; fromConstName: string; slug: string;
};

export function createLevelSourceText(opts: CreateLevelSourceOptions): string {
  const eol = opts.fromText.includes('\r\n') ? '\r\n' : '\n';
  let text = opts.fromText.replace(/\r\n/g, '\n');
  text = replaceOnce(text, /^  id: '[^']*',$/m, `  id: ${quote(opts.id)},`, 'id');
  text = replaceOnce(text, /^  title: '(?:[^'\\]|\\.)*',$/m, `  title: ${quote(opts.title)},`, 'title');
  text = replaceOnce(text, /^  order: \d+,$/m, `  order: ${opts.order},`, 'order');
  text = replaceOnce(text, /^  contentRevision: '[^']*',$/m, `  contentRevision: ${quote(`${opts.slug}-v1`)},`, 'contentRevision');
  const chapter = /^([1-4])-/.exec(opts.id);
  if (chapter) text = replaceOnce(text, /^  chapter: \d+,$/m, `  chapter: ${chapter[1]},`, 'chapter');
  const constName = constNameFromTitle(opts.title);
  text = replaceOnce(text, new RegExp(`^export const ${opts.fromConstName}: LevelSource =`, 'm'), `export const ${constName}: LevelSource =`, `export const ${opts.fromConstName}`);
  return text.replace(/\n/g, eol);
}

const IMPORT_LINE = /^import \{ (\w+) \} from '\.\/([^']+)\.ts';$/;
const ENTRY_LINE = /^  '([^']+)': (\w+),$/;
type IndexRow = { line: number; id: string; name: string };

/**
 * The const name `sources/index.ts` currently registers for an id, or null.
 *
 * The const name is a stable identifier tied to the level id, NOT something
 * re-derived from the title on every write. Several levels carry hand-written
 * names shorter than their title (`baoThap` for "Bảo Tháp Tiên Tri"), so
 * regenerating the name from the title on overwrite leaves `index.ts`
 * importing a name that no longer exists, which breaks the whole build.
 *
 * Returns a name only when the import line and the LEVEL_SOURCES entry agree
 * on that id; half a registration counts as none.
 */
export function constNameInSourceIndex(indexText: string, id: string): string | null {
  const lines = indexText.replace(/\r\n/g, '\n').split('\n');
  let importName: string | null = null;
  let entryName: string | null = null;
  for (const text of lines) {
    const im = IMPORT_LINE.exec(text);
    if (im && im[2] === id) importName = im[1];
    const en = ENTRY_LINE.exec(text);
    if (en && en[1] === id) entryName = en[2];
  }
  return importName !== null && importName === entryName ? importName : null;
}

/** Thêm một dòng import và một dòng trong bảng LEVEL_SOURCES, giữ thứ tự theo id. */
export function registerInSourceIndex(indexText: string, id: string, constName: string): string {
  const eol = indexText.includes('\r\n') ? '\r\n' : '\n';
  const lines = indexText.replace(/\r\n/g, '\n').split('\n');
  const imports: IndexRow[] = [];
  const entries: IndexRow[] = [];
  lines.forEach((text, line) => {
    const im = IMPORT_LINE.exec(text);
    if (im) imports.push({ line, id: im[2], name: im[1] });
    const en = ENTRY_LINE.exec(text);
    if (en) entries.push({ line, id: en[1], name: en[2] });
  });
  if (imports.length === 0 || entries.length === 0) throw new Error('sources/index.ts không đúng dạng: cần ít nhất một dòng import nguồn và một dòng trong LEVEL_SOURCES');
  if (imports.some((r) => r.id === id) || entries.some((r) => r.id === id)) throw new Error(`Màn ${id} đã được đăng ký trong sources/index.ts`);
  if (imports.some((r) => r.name === constName)) throw new Error(`Tên hằng ${constName} đã dùng trong sources/index.ts; đặt --title khác`);
  const entryAt = entries.find((r) => compareLevelIds(id, r.id) < 0)?.line ?? entries[entries.length - 1].line + 1;
  lines.splice(entryAt, 0, `  '${id}': ${constName},`);
  const importAt = imports.find((r) => compareLevelIds(id, r.id) < 0)?.line ?? imports[imports.length - 1].line + 1;
  lines.splice(importAt, 0, `import { ${constName} } from './${id}.ts';`);
  return lines.join(eol);
}
