import { describe, expect, test } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

const KEY = 'nozvi.progress.v1';
const REV = 'oracle-v2';

function mockStorage(initial: Record<string, string> = {}): StoragePort & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('Progress v2', () => {
  test('a fresh save is version 2 with no level results', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    const { progress } = repo.read();
    expect(progress.version).toBe(2);
    expect(progress.levels).toEqual({});
  });

  test('a v1 save migrates: completed kept, levels empty', () => {
    const storage = mockStorage({
      [KEY]: JSON.stringify({
        version: 1,
        campaignRevision: REV,
        completed: ['1-1', '1-2'],
        settings: { showTarget: true, reducedMotion: false, haptics: true, music: true, sfx: true },
      }),
    });
    const repo = createProgressRepository(storage, campaignManifest, REV);
    const { progress, recovered } = repo.read();
    expect(recovered).toBe(false);
    expect(progress.version).toBe(2);
    expect(progress.completed).toEqual(['1-1', '1-2']);
    expect(progress.levels).toEqual({});
  });

  test('unknown or malformed level results are dropped', () => {
    const storage = mockStorage({
      [KEY]: JSON.stringify({
        version: 2,
        campaignRevision: REV,
        completed: ['1-1'],
        levels: { '1-1': { stars: 2, bestMs: 8000 }, nope: { stars: 3, bestMs: 1 }, '1-2': { stars: 9, bestMs: 'x' } },
        settings: { showTarget: true, reducedMotion: false, haptics: true, music: true, sfx: true },
      }),
    });
    const { progress } = createProgressRepository(storage, campaignManifest, REV).read();
    expect(progress.levels).toEqual({ '1-1': { stars: 2, bestMs: 8000 } });
  });
});

describe('recordResult', () => {
  test('first clear stores the result and completes the level', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    const rec = repo.recordResult('1-1', 9000, 2);
    expect(rec.previous).toBeNull();
    expect(rec.improved).toBe(true);
    expect(rec.current).toEqual({ stars: 2, bestMs: 9000 });
    expect(repo.read().progress.completed).toContain('1-1');
  });

  test('more stars replaces the best even when slower', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    repo.recordResult('1-1', 9000, 2);
    const rec = repo.recordResult('1-1', 20_000, 3);
    expect(rec.improved).toBe(true);
    expect(rec.previous).toEqual({ stars: 2, bestMs: 9000 });
    expect(rec.current).toEqual({ stars: 3, bestMs: 20_000 });
  });

  test('same stars and faster replaces the best time', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    repo.recordResult('1-1', 9000, 2);
    const rec = repo.recordResult('1-1', 7000, 2);
    expect(rec.improved).toBe(true);
    expect(rec.current).toEqual({ stars: 2, bestMs: 7000 });
  });

  test('fewer stars or same stars slower keeps the stored best', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    repo.recordResult('1-1', 9000, 2);
    expect(repo.recordResult('1-1', 30_000, 1).improved).toBe(false);
    const slower = repo.recordResult('1-1', 12_000, 2);
    expect(slower.improved).toBe(false);
    expect(slower.current).toEqual({ stars: 2, bestMs: 9000 });
  });

  test('a locked level cannot be recorded', () => {
    const repo = createProgressRepository(mockStorage(), campaignManifest, REV);
    expect(() => repo.recordResult('1-3', 5000, 3)).toThrow('cannot-complete-locked:1-3');
  });

  test('memory-only storage still returns a result', () => {
    const broken: StoragePort = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const rec = createProgressRepository(broken, campaignManifest, REV).recordResult('1-1', 5000, 3);
    expect(rec.load.persistence).toBe('memory-only');
    expect(rec.current.stars).toBe(3);
  });
});
