import { describe, expect, test } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { levelAccess, nextLevelId } from '../src/domain/campaign.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

function createMockStorage(initial: Record<string, string> = {}): StoragePort & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key: string): string | null {
      return data[key] ?? null;
    },
    setItem(key: string, value: string): void {
      data[key] = value;
    },
  };
}

describe('Campaign Progress and Persistence', () => {
  test('màn đầu tiên (1-1) luôn mở khóa; màn kế tiếp chỉ mở khi màn trước hoàn thành', () => {
    // Chưa hoàn thành màn nào
    const access1 = levelAccess(campaignManifest, [], '1-1');
    expect(access1.unlocked).toBe(true);
    expect(access1.completed).toBe(false);

    const access2 = levelAccess(campaignManifest, [], '1-2');
    expect(access2.unlocked).toBe(false);

    // Sau khi hoàn thành 1-1
    const access2After = levelAccess(campaignManifest, ['1-1'], '1-2');
    expect(access2After.unlocked).toBe(true);
    expect(access2After.completed).toBe(false);
  });

  test('nextLevelId trả đúng ID màn tiếp theo hoặc null ở màn cuối', () => {
    expect(nextLevelId(campaignManifest, '1-1')).toBe('1-2');
    expect(nextLevelId(campaignManifest, '2-9')).toBe('2-10');
    expect(nextLevelId(campaignManifest, '2-27')).toBe('2-28');
    expect(nextLevelId(campaignManifest, '2-28')).toBe('3-1');
    expect(nextLevelId(campaignManifest, '3-9')).toBe('3-10');
    expect(nextLevelId(campaignManifest, '3-10')).toBe('3-11');
    expect(nextLevelId(campaignManifest, '3-19')).toBe('3-20');
    expect(nextLevelId(campaignManifest, '3-20')).toBeNull();
    expect(nextLevelId(campaignManifest, 'nonexistent')).toBeNull();
  });

  test('createProgressRepository khởi tạo default và lưu vào storage', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');

    const result = repo.read();
    expect(result.progress.version).toBe(2);
    expect(result.progress.campaignRevision).toBe('oracle-v1');
    expect(result.progress.completed).toEqual([]);
    expect(result.progress.levels).toEqual({});
    expect(result.recovered).toBe(false);
    expect(result.persistence).toBe('persisted');
    expect(storage.data['nozvi.progress.v1']).toBeDefined();
  });

  test('hoàn thành màn 1-1 cập nhật danh sách completed và persist vào storage', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');

    const updated = repo.complete('1-1');
    expect(updated.progress.completed).toEqual(['1-1']);

    // Đọc lại từ storage mới
    const repo2 = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    expect(repo2.read().progress.completed).toEqual(['1-1']);
  });

  test('không cho phép hoàn thành màn đang bị khóa', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');

    // Cố gắng hoàn thành 1-2 khi 1-1 chưa xong
    expect(() => repo.complete('1-2')).toThrow('cannot-complete-locked:1-2');
  });

  test('tự phục hồi khi storage chứa JSON lỗi hoặc sai schema', () => {
    const storage = createMockStorage({
      'nozvi.progress.v1': '{ corrupted-json-data :::',
    });
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');

    const result = repo.read();
    expect(result.recovered).toBe(true);
    expect(result.progress.completed).toEqual([]);
    // Kiểm tra đã sao lưu dữ liệu lỗi sang recovery key
    expect(storage.data['nozvi.progress.recovery']).toBe('{ corrupted-json-data :::');
  });

  test('tự động fallback sang memory-only khi storage throw ngoại lệ', () => {
    const faultyStorage: StoragePort = {
      getItem(): string {
        throw new Error('QuotaExceeded / SecurityError');
      },
      setItem(): void {
        throw new Error('QuotaExceeded / SecurityError');
      },
    };

    const repo = createProgressRepository(faultyStorage, campaignManifest, 'oracle-v1');
    const result = repo.read();
    expect(result.persistence).toBe('memory-only');
    expect(result.progress.completed).toEqual([]);

    // Hoàn thành vẫn hoạt động trong memory
    const completed = repo.complete('1-1');
    expect(completed.persistence).toBe('memory-only');
    expect(completed.progress.completed).toEqual(['1-1']);
  });

  test('setShowTarget cập nhật cấu hình hiển thị bóng mục tiêu', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');

    const res = repo.setShowTarget(false);
    expect(res.progress.settings.showTarget).toBe(false);

    const reloaded = repo.read();
    expect(reloaded.progress.settings.showTarget).toBe(false);
  });
});

describe('Cài đặt Giảm chuyển động', () => {
  test('mặc định tắt', () => {
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    expect(repo.read().progress.settings.reducedMotion).toBe(false);
  });

  test('ghi rồi đọc lại giữ đúng giá trị, không đụng showTarget', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    repo.setShowTarget(false);
    repo.setReducedMotion(true);
    const again = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    expect(again.read().progress.settings).toEqual({ showTarget: false, reducedMotion: true, haptics: true, music: true, sfx: true });
  });

  test('bản lưu cũ thiếu trường đọc ra false, không bị coi là hỏng', () => {
    const legacy = JSON.stringify({
      version: 1,
      campaignRevision: 'oracle-v1',
      completed: ['1-1'],
      settings: { showTarget: true },
    });
    const storage = createMockStorage({ 'nozvi.progress.v1': legacy });
    const result = createProgressRepository(storage, campaignManifest, 'oracle-v1').read();
    expect(result.recovered).toBe(false);
    expect(result.progress.completed).toEqual(['1-1']);
    expect(result.progress.settings.reducedMotion).toBe(false);
  });
});

describe('Cài đặt Rung phản hồi', () => {
  test('mặc định bật, bản lưu cũ thiếu trường đọc là true', () => {
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    expect(repo.read().progress.settings.haptics).toBe(true);
    const legacy = JSON.stringify({
      version: 1, campaignRevision: 'oracle-v1', completed: [], settings: { showTarget: true, reducedMotion: false },
    });
    const old = createProgressRepository(createMockStorage({ 'nozvi.progress.v1': legacy }), campaignManifest, 'oracle-v1');
    expect(old.read().progress.settings.haptics).toBe(true);
    expect(old.read().recovered).toBe(false);
  });

  test('setHaptics lưu và giữ các cài đặt khác', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    repo.setReducedMotion(true);
    repo.setHaptics(false);
    expect(createProgressRepository(storage, campaignManifest, 'oracle-v1').read().progress.settings)
      .toEqual({ showTarget: true, reducedMotion: true, haptics: false, music: true, sfx: true });
  });
});



describe('Audio settings', () => {
  test('both default on', () => {
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    expect(repo.read().progress.settings.music).toBe(true);
    expect(repo.read().progress.settings.sfx).toBe(true);
  });

  test('saved independently of other settings', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    repo.setMusic(false);
    repo.setSfx(false);
    repo.setSfx(true);
    const again = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    expect(again.read().progress.settings).toEqual({
      showTarget: true,
      reducedMotion: false,
      haptics: true,
      music: false,
      sfx: true,
    });
  });

  test('a legacy save without the keys reads true and is not marked recovered', () => {
    const storage = createMockStorage();
    createProgressRepository(storage, campaignManifest, 'oracle-v1').read();
    const raw = JSON.parse(storage.getItem('nozvi.progress.v1') ?? '{}') as {
      settings: Record<string, unknown>;
    };
    delete raw.settings.music;
    delete raw.settings.sfx;
    storage.setItem('nozvi.progress.v1', JSON.stringify(raw));

    const loaded = createProgressRepository(storage, campaignManifest, 'oracle-v1').read();
    expect(loaded.progress.settings.music).toBe(true);
    expect(loaded.progress.settings.sfx).toBe(true);
    expect(loaded.recovered).toBe(false);
  });
});
