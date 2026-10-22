import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, test } from 'vitest';
import rawSongTinh from '../src/content/levels/1-1.json';
import type { LevelDocument } from '../src/content/document.ts';
import {
  bumpRevision,
  preserveHeaderComment,
  promoteStudioLevel,
  registerInCatalog,
  sourceFromDocument,
  updateAuthoredLevels,
  updateManifestLine,
} from '../src/content/promote.ts';
import { saveStudioLevel } from '../src/content/studioStore.ts';

const TMP_ROOT = resolve(process.cwd(), 'tests/.tmp-promote');

describe('sourceFromDocument (spec E, ST-08)', () => {
  const doc = rawSongTinh as unknown as LevelDocument;

  test('chuyển LevelDocument sang LevelSource bỏ các trường tự sinh', () => {
    const source = sourceFromDocument(doc);
    expect(source.id).toBe(doc.id);
    expect(source.title).toBe(doc.title);
    expect((source as any).schemaVersion).toBeUndefined();
    expect((source as any).board).toBeUndefined();
    expect((source as any).targetCells).toBeUndefined();
    expect(source.pieces).toHaveLength(doc.pieces.length);
    for (const p of source.pieces) {
      expect((p as any).cells).toBeUndefined();
      expect((p as any).color).toBeUndefined();
      expect(p.frameSize).toBeDefined();
      expect(p.anchors).toBeDefined();
    }
  });

  test('áp dụng override id, chapter, order từ manifest', () => {
    const source = sourceFromDocument(doc, {
      id: '3-1',
      chapter: 3,
      order: 23,
    });
    expect(source.id).toBe('3-1');
    expect(source.chapter).toBe(3);
    expect(source.order).toBe(23);
    expect(source.title).toBe(doc.title);
    expect(source.contentRevision).toBe(doc.contentRevision);
  });
});

describe('Helper cập nhật file (promote)', () => {
  test('registerInCatalog thêm import và documents entry theo thứ tự id', () => {
    const mockCatalog = [
      "import songTinh from './levels/1-1.json';",
      "import haiDang from './levels/1-4.json';",
      '',
      'const documents: Record<string, unknown> = {',
      "  '1-1': songTinh,",
      "  '1-4': haiDang,",
      '};',
    ].join('\n');

    const result = registerInCatalog(mockCatalog, '1-2', 'baoThap');
    expect(result).toContain("import baoThap from './levels/1-2.json';");
    expect(result).toContain("  '1-2': baoThap,");

    const lines = result.split('\n');
    const idx11 = lines.findIndex((l) => l.includes("'1-1'"));
    const idx12 = lines.findIndex((l) => l.includes("'1-2'"));
    const idx14 = lines.findIndex((l) => l.includes("'1-4'"));
    expect(idx12).toBeGreaterThan(idx11);
    expect(idx12).toBeLessThan(idx14);
  });

  test('updateManifestLine đổi planned sang validated và gắn dataPath', () => {
    const mockManifest = [
      'export const campaignManifest = [',
      "  { id: '1-1', title: 'Song Tinh', chapter: 1, order: 1, contentRevision: 'v1', status: 'approved', dataPath: 'src/content/levels/1-1.json' },",
      "  { id: '3-1', title: 'La Bàn Gió', chapter: 3, order: 23, contentRevision: 'v0.1', status: 'planned' },",
      '];',
    ].join('\n');

    const result = updateManifestLine(mockManifest, {
      id: '3-1',
      title: 'Studio Song Tinh',
      chapter: 3,
      order: 23,
      contentRevision: 'studio-rev-1',
    });

    expect(result).toContain(
      "{ id: '3-1', title: 'Studio Song Tinh', chapter: 3, order: 23, contentRevision: 'studio-rev-1', status: 'validated', dataPath: 'src/content/levels/3-1.json' }"
    );
    expect(result).not.toContain("status: 'planned'");
  });

  test('updateAuthoredLevels thêm id mới vào set AUTHORED_LEVELS', () => {
    const mockTestCode = "const AUTHORED_LEVELS = new Set(['1-2', '1-4']);";
    const result = updateAuthoredLevels(mockTestCode, '1-3');
    expect(result).toBe("const AUTHORED_LEVELS = new Set(['1-2', '1-3', '1-4']);");
  });
});

describe('promoteStudioLevel (spec E, ST-08)', () => {
  beforeEach(() => {
    rmSync(TMP_ROOT, { recursive: true, force: true });
    mkdirSync(resolve(TMP_ROOT, 'src/content/sources'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'src/content/levels'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'tests'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'docs/testing/levels'), { recursive: true });

    // Mock manifest.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/manifest.ts'),
      [
        "import type { ManifestEntry } from './document.ts';",
        'export const campaignManifest: readonly ManifestEntry[] = [',
        "  { id: '1-1', title: 'Song Tinh', chapter: 1, order: 1, contentRevision: 'v1', status: 'approved', dataPath: 'src/content/levels/1-1.json' },",
        "  { id: '3-1', title: 'La Bàn Gió', chapter: 3, order: 23, contentRevision: 'v0.1', status: 'planned' },",
        "  { id: '2-1', title: 'Mũi Tên', chapter: 2, order: 11, contentRevision: 'v0.1', status: 'planned' },",
        '];',
      ].join('\n'),
      'utf8'
    );

    // Mock catalog.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/catalog.ts'),
      [
        "import songTinh from './levels/1-1.json';",
        'const documents: Record<string, unknown> = {',
        "  '1-1': songTinh,",
        '};',
      ].join('\n'),
      'utf8'
    );

    // Mock sources/index.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/sources/index.ts'),
      [
        "import { songTinh } from './1-1.ts';",
        'export const LEVEL_SOURCES: Record<string, LevelSource> = {',
        "  '1-1': songTinh,",
        '};',
      ].join('\n'),
      'utf8'
    );

    // Mock tests/content.test.ts
    writeFileSync(
      resolve(TMP_ROOT, 'tests/content.test.ts'),
      "const AUTHORED_LEVELS = new Set(['1-1']);\n",
      'utf8'
    );
  });

  afterEach(() => {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  test('từ chối khi studio-id không tồn tại', () => {
    const res = promoteStudioLevel({
      studioId: 'non-existent',
      targetId: '3-1',
      root: TMP_ROOT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('studio-not-found');
    }
  });

  test('từ chối khi target-id không ở trạng thái planned', () => {
    // Lưu một màn studio hợp lệ
    const source = sourceFromDocument(rawSongTinh as unknown as LevelDocument, {
      id: 'studio-valid',
      title: 'Studio Valid',
    });
    const saveRes = saveStudioLevel({
      source,
      root: TMP_ROOT,
      manifestIds: new Set(['1-1', '3-1']),
      sourceIds: new Set(['1-1']),
    });
    expect(saveRes.ok).toBe(true);

    // Thử promote vào 1-1 (đã approved)
    const res = promoteStudioLevel({
      studioId: 'studio-valid',
      targetId: '1-1',
      root: TMP_ROOT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('target-not-planned');
    }
  });

  test('promote thành công: sinh file campaign, cập nhật index, catalog, manifest, test, và xoá studio', () => {
    // Lưu một màn studio hợp lệ cho Chapter 2
    const source = sourceFromDocument(rawSongTinh as unknown as LevelDocument, {
      id: 'studio-valid',
      title: 'Studio Song Tinh',
      chapter: 2,
    });

    const saveRes = saveStudioLevel({
      source,
      root: TMP_ROOT,
      manifestIds: new Set(['1-1', '2-1']),
      sourceIds: new Set(['1-1']),
    });
    expect(saveRes.ok).toBe(true);

    const res = promoteStudioLevel({
      studioId: 'studio-valid',
      targetId: '2-1',
      root: TMP_ROOT,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.targetId).toBe('2-1');

      // 1. Nguồn campaign đã ghi
      const campaignSourcePath = resolve(TMP_ROOT, 'src/content/sources/2-1.ts');
      expect(existsSync(campaignSourcePath)).toBe(true);

      // 2. sources/index.ts đã cập nhật
      const indexText = readFileSync(resolve(TMP_ROOT, 'src/content/sources/index.ts'), 'utf8');
      expect(indexText).toContain("import { studioSongTinh } from './2-1.ts';");
      expect(indexText).toContain("'2-1': studioSongTinh,");

      // 3. JSON level đã ghi
      const jsonPath = resolve(TMP_ROOT, 'src/content/levels/2-1.json');
      expect(existsSync(jsonPath)).toBe(true);

      // 4. SVG preview & report đã ghi
      expect(existsSync(resolve(TMP_ROOT, 'docs/testing/levels/2-1.svg'))).toBe(true);
      expect(existsSync(resolve(TMP_ROOT, 'docs/testing/levels/2-1-report.md'))).toBe(true);

      // 5. catalog.ts đã cập nhật
      const catalogText = readFileSync(resolve(TMP_ROOT, 'src/content/catalog.ts'), 'utf8');
      expect(catalogText).toContain("import studioSongTinh from './levels/2-1.json';");
      expect(catalogText).toContain("'2-1': studioSongTinh,");

      // 6. manifest.ts đã cập nhật
      const manifestText = readFileSync(resolve(TMP_ROOT, 'src/content/manifest.ts'), 'utf8');
      expect(manifestText).toContain("status: 'validated'");
      expect(manifestText).toContain("dataPath: 'src/content/levels/2-1.json'");

      // 7. tests/content.test.ts đã cập nhật AUTHORED_LEVELS
      const testText = readFileSync(resolve(TMP_ROOT, 'tests/content.test.ts'), 'utf8');
      expect(testText).toContain("'2-1'");

      // 8. 4 file studio đã bị xoá
      expect(existsSync(resolve(TMP_ROOT, 'src/content/studio/sources/studio-valid.ts'))).toBe(false);
      expect(existsSync(resolve(TMP_ROOT, 'src/content/studio/levels/studio-valid.json'))).toBe(false);
      expect(existsSync(resolve(TMP_ROOT, 'docs/testing/levels/studio/studio-valid.svg'))).toBe(false);
      expect(existsSync(resolve(TMP_ROOT, 'docs/testing/levels/studio/studio-valid-report.md'))).toBe(false);
    }
  });

  test('từ chối khi quy tắc xoay của chương đích không thỏa mãn', () => {
    // Nguồn không bật xoay
    const source = sourceFromDocument(rawSongTinh as unknown as LevelDocument, {
      id: 'studio-no-rot',
      title: 'Studio No Rot',
      chapter: 1,
    });
    source.rotationEnabled = false;

    const saveRes = saveStudioLevel({
      source,
      root: TMP_ROOT,
      manifestIds: new Set(['1-1', '3-1']),
      sourceIds: new Set(['1-1']),
    });
    expect(saveRes.ok).toBe(true);

    // Promote vào 3-1 (Chương 3 bắt buộc rotationEnabled: true)
    const res = promoteStudioLevel({
      studioId: 'studio-no-rot',
      targetId: '3-1',
      root: TMP_ROOT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('authoring-validation-failed');
    }
  });
});

function snapshotRepo(root: string): Record<string, string> {
  const files = [
    'src/content/manifest.ts',
    'src/content/catalog.ts',
    'src/content/sources/index.ts',
    'src/content/sources/1-4.ts',
  ];
  const out: Record<string, string> = {};
  for (const f of files) {
    const p = resolve(root, f);
    if (existsSync(p)) out[f] = readFileSync(p, 'utf8');
  }
  return out;
}

describe('promoteStudioLevel overwrite', () => {
  beforeEach(() => {
    rmSync(TMP_ROOT, { recursive: true, force: true });
    mkdirSync(resolve(TMP_ROOT, 'src/content/sources'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'src/content/levels'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'tests'), { recursive: true });
    mkdirSync(resolve(TMP_ROOT, 'docs/testing/levels'), { recursive: true });

    // Mock manifest.ts with 1-4 approved and contentRevision: 'thu-nghiem-v1'
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/manifest.ts'),
      [
        "import type { ManifestEntry } from './document.ts';",
        'export const campaignManifest: readonly ManifestEntry[] = [',
        "  { id: '1-1', title: 'Song Tinh', chapter: 1, order: 1, contentRevision: 'v1', status: 'validated', dataPath: 'src/content/levels/1-1.json' },",
        "  { id: '1-4', title: 'Hải Đăng', chapter: 1, order: 4, contentRevision: 'thu-nghiem-v1', status: 'approved', dataPath: 'src/content/levels/1-4.json' },",
        '];',
      ].join('\n'),
      'utf8'
    );

    // Mock catalog.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/catalog.ts'),
      [
        "import songTinh from './levels/1-1.json';",
        "import haiDang from './levels/1-4.json';",
        'const documents: Record<string, unknown> = {',
        "  '1-1': songTinh,",
        "  '1-4': haiDang,",
        '};',
      ].join('\n'),
      'utf8'
    );

    // Mock sources/index.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/sources/index.ts'),
      [
        "import { songTinh } from './1-1.ts';",
        "import { haiDang } from './1-4.ts';",
        'export const LEVEL_SOURCES: Record<string, LevelSource> = {',
        "  '1-1': songTinh,",
        "  '1-4': haiDang,",
        '};',
      ].join('\n'),
      'utf8'
    );

    // Mock sources/1-4.ts
    writeFileSync(
      resolve(TMP_ROOT, 'src/content/sources/1-4.ts'),
      [
        "import type { LevelSource } from '../authoring.ts';",
        '',
        '/**',
        ' * 1-4 Hải Đăng: đèn chiếu từ đỉnh tháp.',
        ' */',
        'export const haiDang: LevelSource = {',
        "  id: '1-4',",
        "  title: 'Hải Đăng',",
        '  chapter: 1,',
        '  order: 4,',
        "  contentRevision: 'thu-nghiem-v1',",
        '  pieces: [],',
        '};',
      ].join('\n'),
      'utf8'
    );

    // Save a valid studio level 'nhap'
    const nhapSource = sourceFromDocument(rawSongTinh as unknown as LevelDocument, {
      id: 'nhap',
      title: 'Hải Đăng Mới',
      chapter: 1,
    });
    saveStudioLevel({
      source: nhapSource,
      root: TMP_ROOT,
      manifestIds: new Set(['1-1', '1-4']),
      sourceIds: new Set(['1-1', '1-4']),
    });

    // Save a multi-solution studio level 'da-nghiem'
    const daNghiemSource = sourceFromDocument(rawSongTinh as unknown as LevelDocument, {
      id: 'da-nghiem',
      title: 'Đa Nghiệm',
      chapter: 1,
    });
    daNghiemSource.placement = 'free';
    daNghiemSource.pieces = [
      { id: 'S1', shapeKind: 'square', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 16, y: 16 }] },
      { id: 'T1', shapeKind: 'triangle', orientation: 0, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 96 }] },
      { id: 'T2', shapeKind: 'triangle', orientation: 2, frameSize: 48, anchors: [{ id: 'A', x: 64, y: 96 }] },
    ];
    daNghiemSource.sampleSolutions = [[
      { pieceId: 'S1', anchorId: 'A', turns: 0 },
      { pieceId: 'T1', anchorId: 'A', turns: 0 },
      { pieceId: 'T2', anchorId: 'A', turns: 0 },
    ]];
    saveStudioLevel({
      source: daNghiemSource,
      root: TMP_ROOT,
      manifestIds: new Set(['1-1', '1-4']),
      sourceIds: new Set(['1-1', '1-4']),
    });
  });

  afterEach(() => {
    rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it('bumpRevision tăng đuôi -v<N>', () => {
    expect(bumpRevision('thuyen-sao-v1')).toBe('thuyen-sao-v2');
    expect(bumpRevision('thuyen-sao-v9')).toBe('thuyen-sao-v10');
    expect(bumpRevision('khong-co-duoi')).toBe('khong-co-duoi-v2');
  });

  it('không có cờ overwrite thì id đã tồn tại vẫn lỗi', () => {
    const res = promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT });
    expect(res.ok).toBe(false);
  });

  it('overwrite ghi đè nguồn, tăng revision, hạ approved về validated', () => {
    const res = promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    expect(res.ok).toBe(true);

    const manifest = readFileSync(resolve(TMP_ROOT, 'src/content/manifest.ts'), 'utf8');
    expect(manifest).toContain("contentRevision: 'thu-nghiem-v2'");
    expect(manifest).toContain("status: 'validated'");
    expect(manifest).not.toContain("status: 'approved'");
  });

  it('overwrite không đăng ký trùng trong index.ts và catalog.ts', () => {
    promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    const index = readFileSync(resolve(TMP_ROOT, 'src/content/sources/index.ts'), 'utf8');
    const catalog = readFileSync(resolve(TMP_ROOT, 'src/content/catalog.ts'), 'utf8');
    expect(index.match(/'1-4':/g)).toHaveLength(1);
    expect(catalog.match(/'1-4':/g)).toHaveLength(1);
  });

  it('overwrite giữ nguyên tên hằng mà index.ts đang import, dù tiêu đề đổi', () => {
    // Nguồn studio tên 'Hải Đăng Mới' → constNameFromTitle là 'haiDangMoi',
    // nhưng index.ts đang import 'haiDang'. Ghi tên mới vào file nguồn mà
    // không sửa index là làm hỏng build toàn repo.
    const res = promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    expect(res.ok).toBe(true);

    const source = readFileSync(resolve(TMP_ROOT, 'src/content/sources/1-4.ts'), 'utf8');
    const index = readFileSync(resolve(TMP_ROOT, 'src/content/sources/index.ts'), 'utf8');

    const exported = source.match(/export const (\w+): LevelSource/)?.[1];
    const imported = index.match(/import \{ (\w+) \} from '\.\/1-4\.ts';/)?.[1];

    expect(exported).toBe('haiDang');
    expect(imported).toBe('haiDang');
    expect(exported).toBe(imported);
  });

  it('overwrite không để lại tên hằng mồ côi trong file nguồn', () => {
    promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    const source = readFileSync(resolve(TMP_ROOT, 'src/content/sources/1-4.ts'), 'utf8');
    const index = readFileSync(resolve(TMP_ROOT, 'src/content/sources/index.ts'), 'utf8');

    // Mọi tên hằng index import cho 1-4 phải thực sự được file nguồn xuất ra.
    const imported = index.match(/import \{ (\w+) \} from '\.\/1-4\.ts';/)?.[1];
    expect(imported).toBeDefined();
    expect(source).toContain(`export const ${imported}: LevelSource`);
  });

  it('nghiệm không duy nhất thì không file nào bị đụng tới', () => {
    const before = snapshotRepo(TMP_ROOT);
    const res = promoteStudioLevel({ studioId: 'da-nghiem', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    expect(res.ok).toBe(false);
    expect(snapshotRepo(TMP_ROOT)).toEqual(before);
  });

  it('giữ khối chú thích của file nguồn khi overwrite', () => {
    const res = promoteStudioLevel({ studioId: 'nhap', targetId: '1-4', root: TMP_ROOT, overwrite: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.preservedComment).toBe(true);
      const source = readFileSync(resolve(TMP_ROOT, 'src/content/sources/1-4.ts'), 'utf8');
      expect(source).toContain('đèn chiếu từ đỉnh tháp');
    }
  });
});

describe('preserveHeaderComment', () => {
  const generated = [
    "import type { LevelSource } from '../authoring.ts';",
    '',
    'export const moi: LevelSource = {',
    '};',
  ].join('\n');

  it('giữ khối chú thích giữa dòng import và export const', () => {
    const old = [
      "import type { LevelSource } from '../authoring.ts';",
      '',
      '/**',
      ' * 1-6 Vương Miện: giải thích quy tắc ô biên chung.',
      ' */',
      'export const cu: LevelSource = {',
      '};',
    ].join('\n');
    const out = preserveHeaderComment(old, generated);
    expect(out).toContain('quy tắc ô biên chung');
    expect(out.indexOf('quy tắc')).toBeLessThan(out.indexOf('export const moi'));
    expect(out).toContain('export const moi: LevelSource = {');
  });

  it('nguồn cũ không có chú thích thì trả nguyên bản sinh', () => {
    const old = [
      "import type { LevelSource } from '../authoring.ts';",
      '',
      'export const cu: LevelSource = {',
      '};',
    ].join('\n');
    expect(preserveHeaderComment(old, generated)).toBe(generated);
  });

  it('nguồn cũ hỏng dạng thì trả nguyên bản sinh', () => {
    expect(preserveHeaderComment('rác', generated)).toBe(generated);
  });
});

