import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createNewLevel } from '../scripts/content/new-level.ts';
import { buildLevelDocument } from '../src/content/authoring.ts';
import { searchSolutions } from '../src/content/authoringReport.ts';
import {
  compareLevelIds,
  constNameFromTitle,
  constNameInSourceIndex,
  createLevelSourceText,
  registerInSourceIndex,
  slugFromTitle,
} from '../src/content/newLevel.ts';
import { levelTemplate } from '../src/content/sources/_template.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import { validateLevel } from '../src/content/validate.ts';

const REAL_SOURCES = fileURLToPath(new URL('../src/content/sources/', import.meta.url));
const SONG_TINH_TEXT = readFileSync(join(REAL_SOURCES, '1-1.ts'), 'utf8').replace(/\r\n/g, '\n');
const MANIFEST = [
  { id: '1-1', title: 'Song Tinh', order: 1 },
  { id: '3-4', title: 'Ngọn Nến', order: 16 },
];
const BASE_INDEX = [
  "import type { LevelSource } from '../authoring.ts';",
  "import { songTinh } from './1-1.ts';",
  '',
  '/** Mọi màn có nguồn mô tả. */',
  'export const LEVEL_SOURCES: Readonly<Record<string, LevelSource>> = {',
  "  '1-1': songTinh,",
  '};',
  '',
].join('\n');

describe('tên hằng, slug và thứ tự id', () => {
  test('bỏ dấu tiếng Việt, camelCase', () => {
    expect(constNameFromTitle('Thuyền Buồm Hoàng Hôn')).toBe('thuyenBuomHoangHon');
    expect(constNameFromTitle('Đại Ấn Hộ Mệnh')).toBe('daiAnHoMenh');
    expect(constNameFromTitle('Ngọn Nến')).toBe('ngonNen');
    expect(constNameFromTitle('3 Sao')).toBe('level3Sao');
    expect(() => constNameFromTitle('…')).toThrow(/không có chữ cái/);
  });

  test('slug không dấu nối gạch ngang', () => {
    expect(slugFromTitle('Mèo Thần')).toBe('meo-than');
    expect(slugFromTitle('Màn 3-11')).toBe('man-3-11');
  });

  test('so id theo số từng phần: 3-9 < 3-10 < 3-11 < 4-1', () => {
    const ids = ['4-1', '3-11', '3-10', '1-1', '3-9'];
    expect([...ids].sort(compareLevelIds)).toEqual(['1-1', '3-9', '3-10', '3-11', '4-1']);
  });
});

describe('createLevelSourceText', () => {
  const opts = {
    id: '3-11',
    order: 29,
    title: 'Ngọn Nến Thử',
    fromText: SONG_TINH_TEXT,
    fromConstName: 'songTinh',
    slug: 'ngon-nen-thu',
  };

  test('đổi id, order, chương, tiêu đề, revision và tên hằng; giữ mảnh', () => {
    const out = createLevelSourceText(opts);
    expect(out).toContain("  id: '3-11',");
    expect(out).toContain('  order: 29,');
    expect(out).toContain('  chapter: 3,');
    expect(out).toContain("  title: 'Ngọn Nến Thử',");
    expect(out).toContain("  contentRevision: 'ngon-nen-thu-v1',");
    expect(out).toContain('export const ngonNenThu: LevelSource =');
    expect(out).not.toContain('export const songTinh');
    expect(out).toContain("      id: 'D1',");
    expect(out).toContain('  rotationEnabled: false,');
  });

  test('thoát dấu nháy đơn trong tiêu đề', () => {
    const out = createLevelSourceText({ ...opts, title: "Mắt 'Tiên' Tri" });
    expect(out).toContain("  title: 'Mắt \\'Tiên\\' Tri',");
    expect(out).toContain('export const matTienTri: LevelSource =');
  });

  test('giữ kiểu xuống dòng CRLF', () => {
    const out = createLevelSourceText({ ...opts, fromText: SONG_TINH_TEXT.replace(/\n/g, '\r\n') });
    expect(out).toContain("  id: '3-11',\r\n");
    expect(out.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });

  test('từ chối nguồn thiếu trường cấp màn', () => {
    const broken = SONG_TINH_TEXT.replace(/^  contentRevision: .*\n/m, '');
    expect(() => createLevelSourceText({ ...opts, fromText: broken })).toThrow(/đúng một dòng contentRevision/);
  });
});

describe('registerInSourceIndex', () => {
  const INDEX = [
    "import type { LevelSource } from '../authoring.ts';",
    "import { songTinh } from './1-1.ts';",
    "import { saoBatPhuong } from './3-9.ts';",
    "import { banSao } from './3-11.ts';",
    '',
    '/** Mọi màn có nguồn mô tả. */',
    'export const LEVEL_SOURCES: Readonly<Record<string, LevelSource>> = {',
    "  '1-1': songTinh,",
    "  '3-9': saoBatPhuong,",
    "  '3-11': banSao,",
    '};',
    '',
  ].join('\n');

  test('chèn import và dòng bảng đúng thứ tự id', () => {
    expect(registerInSourceIndex(INDEX, '3-10', 'mandalaThienCau')).toBe(
      [
        "import type { LevelSource } from '../authoring.ts';",
        "import { songTinh } from './1-1.ts';",
        "import { saoBatPhuong } from './3-9.ts';",
        "import { mandalaThienCau } from './3-10.ts';",
        "import { banSao } from './3-11.ts';",
        '',
        '/** Mọi màn có nguồn mô tả. */',
        'export const LEVEL_SOURCES: Readonly<Record<string, LevelSource>> = {',
        "  '1-1': songTinh,",
        "  '3-9': saoBatPhuong,",
        "  '3-10': mandalaThienCau,",
        "  '3-11': banSao,",
        '};',
        '',
      ].join('\n')
    );
  });

  test('id lớn nhất nối vào cuối; giữ CRLF', () => {
    const out = registerInSourceIndex(INDEX.replace(/\n/g, '\r\n'), '4-1', 'laBanGio');
    expect(out).toContain("import { banSao } from './3-11.ts';\r\nimport { laBanGio } from './4-1.ts';\r\n");
    expect(out).toContain("  '3-11': banSao,\r\n  '4-1': laBanGio,\r\n};");
  });

  test('từ chối id hoặc tên hằng đã đăng ký', () => {
    expect(() => registerInSourceIndex(INDEX, '3-9', 'khac')).toThrow(/Màn 3-9 đã được đăng ký/);
    expect(() => registerInSourceIndex(INDEX, '2-1', 'songTinh')).toThrow(/Tên hằng songTinh/);
  });
});

describe('_template.ts', () => {
  test('là một LevelSource hợp lệ tối thiểu: một vuông 48 giữa bàn, một nghiệm', () => {
    expect(levelTemplate.pieces).toHaveLength(1);
    expect(levelTemplate.pieces[0]).toMatchObject({ shapeKind: 'square', frameSize: 48 });
    expect(levelTemplate.pieces[0].anchors[0]).toEqual({ id: 'A', x: 40, y: 56 });
    const doc = buildLevelDocument(levelTemplate);
    expect(validateLevel(doc).ok).toBe(true);
    expect(searchSolutions(doc).solutionCount).toBe(1);
  });

  test('không được đăng ký trong LEVEL_SOURCES', () => {
    expect(Object.values(LEVEL_SOURCES)).not.toContain(levelTemplate);
    expect(Object.keys(LEVEL_SOURCES)).not.toContain(levelTemplate.id);
  });
});

describe('createNewLevel trên thư mục tạm', () => {
  let root = '';
  let sourcesDir = '';
  let studioDir = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'new-level-'));
    sourcesDir = join(root, 'sources');
    studioDir = join(root, 'studio');
    mkdirSync(sourcesDir);
    mkdirSync(studioDir);
    for (const file of ['1-1.ts', '_template.ts']) {
      copyFileSync(join(REAL_SOURCES, file), join(sourcesDir, file));
    }
    // Fixture cố định: test không phụ thuộc các nguồn đang đăng ký trong repo thật.
    writeFileSync(join(sourcesDir, 'index.ts'), BASE_INDEX, 'utf8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('clone đổi id, order, tên hằng, revision và đăng ký vào index.ts', () => {
    const result = createNewLevel({ id: '3-11', from: '1-1', title: 'Ngọn Nến Thử', sourcesDir, studioDir, manifest: MANIFEST });
    expect(result.filePath).toBe(join(sourcesDir, '3-11.ts'));
    expect(result.constName).toBe('ngonNenThu');
    expect(result.nextCommand).toBe('npm run content:author -- 3-11');
    const text = readFileSync(result.filePath, 'utf8');
    expect(text).toContain("  id: '3-11',");
    expect(text).toContain('  order: 17,');
    expect(text).toContain('  chapter: 3,');
    expect(text).toContain("  contentRevision: 'ngon-nen-thu-v1',");
    expect(text).toContain('export const ngonNenThu: LevelSource =');
    const index = readFileSync(join(sourcesDir, 'index.ts'), 'utf8');
    expect(index).toContain("import { ngonNenThu } from './3-11.ts';");
    expect(index).toContain("  '3-11': ngonNenThu,");
  });

  test('không có --from: sao chép _template.ts, lấy tên và order từ manifest', () => {
    const result = createNewLevel({ id: '3-4', sourcesDir, studioDir, manifest: MANIFEST });
    expect(result.constName).toBe('ngonNen');
    const text = readFileSync(result.filePath, 'utf8');
    expect(text).toContain("  title: 'Ngọn Nến',");
    expect(text).toContain('  order: 16,');
    expect(text).toContain("  contentRevision: 'ngon-nen-v1',");
    expect(text).toContain("piece('S1', 'square', 48, [64, 80]");
  });

  test('đăng ký đúng thứ tự trong index.ts', () => {
    createNewLevel({ id: '2-1', title: 'Mũi Tên Chỉ Thiên', sourcesDir, studioDir, manifest: MANIFEST });
    const lines = readFileSync(join(sourcesDir, 'index.ts'), 'utf8').replace(/\r\n/g, '\n').split('\n');
    const importAt = lines.indexOf("import { muiTenChiThien } from './2-1.ts';");
    const entryAt = lines.indexOf("  '2-1': muiTenChiThien,");
    expect(importAt).toBeGreaterThan(0);
    expect(entryAt).toBeGreaterThan(importAt);
    lines.forEach((line, i) => {
      if (/^import \{ \w+ \} from '\.\/1-\d+\.ts';$/.test(line)) expect(i).toBeLessThan(importAt);
      if (/^  '1-\d+': \w+,$/.test(line)) expect(i).toBeLessThan(entryAt);
    });
  });

  test('tìm nguồn trong studio/ khi sources/ không có', () => {
    writeFileSync(join(studioDir, '9-1.ts'), SONG_TINH_TEXT.replace("id: '1-1'", "id: '9-1'"), 'utf8');
    const result = createNewLevel({ id: '3-12', from: '9-1', title: 'Bản Xưởng', sourcesDir, studioDir, manifest: MANIFEST });
    expect(readFileSync(result.filePath, 'utf8')).toContain("  id: '3-12',");
  });

  test('từ chối id đã có nguồn trong sources/ hoặc studio/, không ghi gì', () => {
    const before = readFileSync(join(sourcesDir, 'index.ts'), 'utf8');
    expect(() => createNewLevel({ id: '1-1', sourcesDir, studioDir, manifest: MANIFEST })).toThrow(/Màn 1-1 đã có nguồn/);
    writeFileSync(join(studioDir, '3-20.ts'), '// nháp xưởng\n', 'utf8');
    expect(() => createNewLevel({ id: '3-20', sourcesDir, studioDir, manifest: MANIFEST })).toThrow(/Màn 3-20 đã có nguồn/);
    expect(existsSync(join(sourcesDir, '3-20.ts'))).toBe(false);
    expect(readFileSync(join(sourcesDir, 'index.ts'), 'utf8')).toBe(before);
  });

  test('từ chối nguồn --from không tồn tại và tên hằng trùng', () => {
    expect(() => createNewLevel({ id: '3-12', from: '7-7', sourcesDir, studioDir, manifest: MANIFEST })).toThrow(/Không tìm thấy nguồn của màn 7-7/);
    expect(() => createNewLevel({ id: '3-12', from: '1-1', title: 'Song Tinh', sourcesDir, studioDir, manifest: MANIFEST })).toThrow(/Tên hằng songTinh/);
    expect(existsSync(join(sourcesDir, '3-12.ts'))).toBe(false);
  });
});

describe('constNameInSourceIndex', () => {
  const INDEX = [
    "import type { LevelSource } from '../authoring.ts';",
    "import { songTinh } from './1-1.ts';",
    "import { baoThap } from './1-2.ts';",
    '',
    'export const LEVEL_SOURCES: Readonly<Record<string, LevelSource>> = {',
    "  '1-1': songTinh,",
    "  '1-2': baoThap,",
    '};',
  ].join('\n');

  test('tra ra tên hằng đang được đăng ký cho một id', () => {
    expect(constNameInSourceIndex(INDEX, '1-2')).toBe('baoThap');
  });

  test('trả null khi id chưa đăng ký', () => {
    expect(constNameInSourceIndex(INDEX, '4-1')).toBeNull();
  });

  test('trả null khi import có mà dòng LEVEL_SOURCES thiếu', () => {
    const broken = INDEX.replace("  '1-2': baoThap,\n", '');
    expect(constNameInSourceIndex(broken, '1-2')).toBeNull();
  });
});
