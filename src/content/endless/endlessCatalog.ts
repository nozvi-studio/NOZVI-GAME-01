import ch1PoolData from './ch1Pool.json';
import { buildLevelDocument, type LevelSource } from '../authoring.ts';
import { validateLevel } from '../validate.ts';
import type { Level } from '../../domain/model.ts';
import { getSafeStorage } from '../../engine/core/platform/safeStorage.ts';

const CH1_POOL = ch1PoolData as unknown as LevelSource[];
export const ENDLESS_CH1_STORAGE_KEY = 'mirror.endless.ch1.level';

/** Lấy số thứ tự màn vô tận hiện tại của một chương (mặc định bắt đầu từ 1) */
export function getEndlessLevelNumber(chapter: number = 1): number {
  const storage = getSafeStorage();
  if (!storage) return 1;
  try {
    const raw = storage.getItem(ENDLESS_CH1_STORAGE_KEY);
    if (raw) {
      const val = parseInt(raw, 10);
      if (Number.isFinite(val) && val >= 1) return val;
    }
  } catch {
    // Không truy cập được localStorage
  }
  return 1;
}

/** Lưu số thứ tự màn vô tận kế tiếp sau khi người chơi thắng */
export function saveEndlessLevelNumber(chapter: number, levelNumber: number): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(ENDLESS_CH1_STORAGE_KEY, String(levelNumber));
  } catch {
    // Không ghi được localStorage
  }
}

/**
 * Nạp màn vô tận của chương tương ứng.
 * Sinh LevelDocument từ LevelSource và xác thực qua validateLevel.
 */
export function loadEndlessLevel(chapter: number, levelNumber: number): Level {
  if (chapter !== 1) {
    throw new Error(`Endless chapter ${chapter} is not yet available`);
  }
  if (!CH1_POOL || CH1_POOL.length === 0) {
    throw new Error('Chapter 1 endless pool is empty');
  }
  const idx = (levelNumber - 1) % CH1_POOL.length;
  const source = CH1_POOL[idx];
  const doc = buildLevelDocument(source);
  doc.title = `Khởi Nguyên - ${levelNumber}`;
  const res = validateLevel(doc);
  if (!res.ok) {
    throw new Error(`Endless level ${levelNumber} failed validation: ${JSON.stringify(res.issues)}`);
  }
  return res.level;
}
