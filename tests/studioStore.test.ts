import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { LevelSource } from '../src/content/authoring.ts';
import { LEVEL_SOURCES } from '../src/content/sources/index.ts';
import {
  STUDIO_ID_PATTERN,
  deleteStudioLevel,
  listStudioLevels,
  saveStudioLevel,
} from '../src/content/studioStore.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('studioStore - Kho lưu màn studio', () => {
  const tempRoot = resolve(tmpdir(), `mirror-studio-store-test-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(tempRoot, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('STUDIO_ID_PATTERN kiểm tra đúng định dạng mã studio', () => {
    expect(STUDIO_ID_PATTERN.test('test-level-1')).toBe(true);
    expect(STUDIO_ID_PATTERN.test('123')).toBe(true);
    expect(STUDIO_ID_PATTERN.test('a')).toBe(true);
    expect(STUDIO_ID_PATTERN.test('Test-Level')).toBe(false); // chữ hoa
    expect(STUDIO_ID_PATTERN.test('test/level')).toBe(false); // dấu /
    expect(STUDIO_ID_PATTERN.test('../test')).toBe(false); // path traversal
    expect(STUDIO_ID_PATTERN.test('')).toBe(false);
    expect(STUDIO_ID_PATTERN.test('a'.repeat(33))).toBe(false); // > 32 ký tự
  });

  test('saveStudioLevel ghi đủ bốn file và trả về đường dẫn tương đối', () => {
    const source: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: 'studio-test-1',
      title: 'Màn Studio Thử Nghiệm',
    };

    const res = saveStudioLevel({
      source,
      root: tempRoot,
      manifestIds: new Set(['1-1']),
      sourceIds: new Set(['1-1']),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.files).toEqual([
      'src/content/studio/studio-test-1.ts',
      'src/content/studio/levels/studio-test-1.json',
      'docs/testing/levels/studio/studio-test-1.svg',
      'docs/testing/levels/studio/studio-test-1-report.md',
    ]);

    expect(existsSync(resolve(tempRoot, res.files[0]))).toBe(true);
    expect(existsSync(resolve(tempRoot, res.files[1]))).toBe(true);
    expect(existsSync(resolve(tempRoot, res.files[2]))).toBe(true);
    expect(existsSync(resolve(tempRoot, res.files[3]))).toBe(true);

    const jsonContent = JSON.parse(
      readFileSync(resolve(tempRoot, res.files[1]), 'utf8')
    );
    expect(jsonContent.id).toBe('studio-test-1');
  });

  test('từ chối id không hợp lệ hoặc chứa ký tự nguy hiểm với 400', () => {
    const badIdSource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: '../escape',
    };

    const res = saveStudioLevel({
      source: badIdSource,
      root: tempRoot,
      manifestIds: new Set(),
      sourceIds: new Set(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.error).toBe('invalid-id');
  });

  test('từ chối tên không có chữ cái/chữ số với 400 invalid-title', () => {
    const badTitleSource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: 'bad-title-level',
      title: '   !@#$%   ',
    };

    const res = saveStudioLevel({
      source: badTitleSource,
      root: tempRoot,
      manifestIds: new Set(),
      sourceIds: new Set(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.error).toBe('invalid-title');
  });

  test('từ chối id trùng với manifest hoặc sources với 409', () => {
    const clashingSource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: '1-1',
    };

    const res = saveStudioLevel({
      source: clashingSource,
      root: tempRoot,
      manifestIds: new Set(['1-1']),
      sourceIds: new Set(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(409);
    expect(res.error).toBe('id-clash-campaign');
  });

  test('từ chối nguồn không hợp lệ với 400 validation-failed', () => {
    const invalidSource: LevelSource = {
      ...structuredClone(LEVEL_SOURCES['1-1']),
      id: 'invalid-source',
      chapter: 99 as any,
    };

    const res = saveStudioLevel({
      source: invalidSource,
      root: tempRoot,
      manifestIds: new Set(),
      sourceIds: new Set(),
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.error).toBe('validation-failed');
    expect(res.issues).toBeDefined();
  });

  test('listStudioLevels sắp xếp theo compareLevelIds và bỏ qua file json hỏng', () => {
    // Lưu thêm màn studio thứ hai
    saveStudioLevel({
      source: {
        ...structuredClone(LEVEL_SOURCES['1-1']),
        id: 'studio-test-10',
        title: 'Màn Số 10',
      },
      root: tempRoot,
      manifestIds: new Set(),
      sourceIds: new Set(),
    });

    saveStudioLevel({
      source: {
        ...structuredClone(LEVEL_SOURCES['1-1']),
        id: 'studio-test-2',
        title: 'Màn Số 2',
      },
      root: tempRoot,
      manifestIds: new Set(),
      sourceIds: new Set(),
    });

    // Tạo file json hỏng trong thư mục levels
    const levelsDir = resolve(tempRoot, 'src/content/studio/levels');
    writeFileSync(resolve(levelsDir, 'corrupt.json'), '{ invalid json ...', 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const list = listStudioLevels({ root: tempRoot });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    // Phải có studio-test-1, studio-test-2, studio-test-10 sắp theo compareLevelIds
    const ids = list.map((l) => l.id);
    expect(ids).toContain('studio-test-1');
    expect(ids).toContain('studio-test-2');
    expect(ids).toContain('studio-test-10');
    expect(ids.indexOf('studio-test-2')).toBeLessThan(ids.indexOf('studio-test-10'));
  });

  test('deleteStudioLevel xoá đúng bốn file và từ chối id không hợp lệ', () => {
    const id = 'studio-test-1';
    const deleteRes = deleteStudioLevel({ id, root: tempRoot });
    expect(deleteRes.ok).toBe(true);
    if (!deleteRes.ok) return;

    expect(deleteRes.deletedFiles).toHaveLength(4);
    expect(existsSync(resolve(tempRoot, `src/content/studio/${id}.ts`))).toBe(false);
    expect(existsSync(resolve(tempRoot, `src/content/studio/levels/${id}.json`))).toBe(false);
    expect(existsSync(resolve(tempRoot, `docs/testing/levels/studio/${id}.svg`))).toBe(false);
    expect(existsSync(resolve(tempRoot, `docs/testing/levels/studio/${id}-report.md`))).toBe(false);

    // Thử xoá id sai mẫu
    const badDelete = deleteStudioLevel({ id: '../bad', root: tempRoot });
    expect(badDelete.ok).toBe(false);
    if (badDelete.ok) return;
    expect(badDelete.status).toBe(400);
  });
});
