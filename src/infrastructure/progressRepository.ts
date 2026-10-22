import type { ManifestEntry } from '../content/document.ts';
import { levelAccess } from '../domain/campaign.ts';
import type { Stars } from '../domain/starRating.ts';
import type {
  LevelResult,
  LoadResult,
  Progress,
  ProgressRepository,
  ResultRecord,
  StoragePort,
} from '../application/progressPort.ts';

const PROGRESS_KEY = 'nozvi.progress.v1';
const RECOVERY_KEY = 'nozvi.progress.recovery';

export function createProgressRepository(
  storage: StoragePort,
  manifest: readonly ManifestEntry[],
  revision: string
): ProgressRepository {
  let memorySnapshot: Progress | null = null;
  let isMemoryOnly = false;

  function defaultProgress(): Progress {
    return {
      version: 2,
      campaignRevision: revision,
      completed: [],
      levels: {},
      settings: {
        showTarget: true,
        reducedMotion: false,
        haptics: true,
        music: true,
        sfx: true,
      },
    };
  }

  function readFromStorage(): LoadResult {
    if (isMemoryOnly && memorySnapshot) {
      return {
        progress: JSON.parse(JSON.stringify(memorySnapshot)),
        recovered: false,
        persistence: 'memory-only',
      };
    }

    let raw: string | null = null;
    try {
      raw = storage.getItem(PROGRESS_KEY);
    } catch {
      isMemoryOnly = true;
      memorySnapshot = memorySnapshot ?? defaultProgress();
      return {
        progress: JSON.parse(JSON.stringify(memorySnapshot)),
        recovered: false,
        persistence: 'memory-only',
      };
    }

    if (!raw) {
      const def = defaultProgress();
      memorySnapshot = def;
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(def));
      } catch {
        isMemoryOnly = true;
      }
      return {
        progress: JSON.parse(JSON.stringify(def)),
        recovered: false,
        persistence: isMemoryOnly ? 'memory-only' : 'persisted',
      };
    }

    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed.version !== 1 && parsed.version !== 2) ||
        parsed.campaignRevision !== revision ||
        !Array.isArray(parsed.completed)
      ) {
        throw new Error('schema-mismatch');
      }

      // Lọc danh sách completed chỉ giữ lại các ID hợp lệ trong manifest
      const validCompleted = parsed.completed.filter(
        (id: unknown) => typeof id === 'string' && manifest.some((m) => m.id === id)
      );

      const levels: Record<string, LevelResult> = {};
      const rawLevels =
        parsed.levels && typeof parsed.levels === 'object' && !Array.isArray(parsed.levels) ? parsed.levels : {};
      for (const [id, value] of Object.entries(rawLevels as Record<string, unknown>)) {
        if (!manifest.some((m) => m.id === id)) continue;
        const v = value as { stars?: unknown; bestMs?: unknown } | null;
        if (!v || typeof v !== 'object') continue;
        const stars = v.stars;
        const bestMs = v.bestMs;
        if (stars !== 0 && stars !== 1 && stars !== 2 && stars !== 3) continue;
        if (bestMs !== null && !(typeof bestMs === 'number' && Number.isFinite(bestMs) && bestMs >= 0)) continue;
        levels[id] = { stars, bestMs };
      }

      const showTarget =
        parsed.settings && typeof parsed.settings.showTarget === 'boolean'
          ? parsed.settings.showTarget
          : true;

      const reducedMotion =
        parsed.settings && typeof parsed.settings.reducedMotion === 'boolean'
          ? parsed.settings.reducedMotion
          : false;

      const haptics =
        parsed.settings && typeof parsed.settings.haptics === 'boolean'
          ? parsed.settings.haptics
          : true;

      const music =
        parsed.settings && typeof parsed.settings.music === 'boolean'
          ? parsed.settings.music
          : true;

      const sfx =
        parsed.settings && typeof parsed.settings.sfx === 'boolean'
          ? parsed.settings.sfx
          : true;

      const progress: Progress = {
        version: 2,
        campaignRevision: revision,
        completed: validCompleted,
        levels,
        settings: { showTarget, reducedMotion, haptics, music, sfx },
      };

      memorySnapshot = progress;
      return {
        progress: JSON.parse(JSON.stringify(progress)),
        recovered: false,
        persistence: 'persisted',
      };
    } catch {
      // Phục hồi dữ liệu lỗi: lưu chuỗi lỗi vào recovery key và trả về default
      try {
        storage.setItem(RECOVERY_KEY, raw);
      } catch {
        // bỏ qua nếu recovery lưu cũng lỗi
      }

      const recovered = defaultProgress();
      memorySnapshot = recovered;
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(recovered));
      } catch {
        isMemoryOnly = true;
      }

      return {
        progress: JSON.parse(JSON.stringify(recovered)),
        recovered: true,
        persistence: isMemoryOnly ? 'memory-only' : 'persisted',
      };
    }
  }

  function saveToStorage(progress: Progress): LoadResult {
    memorySnapshot = JSON.parse(JSON.stringify(progress));

    if (!isMemoryOnly) {
      try {
        storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      } catch {
        isMemoryOnly = true;
      }
    }

    return {
      progress: JSON.parse(JSON.stringify(progress)),
      recovered: false,
      persistence: isMemoryOnly ? 'memory-only' : 'persisted',
    };
  }

  return {
    read(): LoadResult {
      return readFromStorage();
    },

    complete(id: string): LoadResult {
      const current = readFromStorage().progress;

      // Nếu đã hoàn thành từ trước, trả về snapshot hiện tại không ghi đè
      if (current.completed.includes(id)) {
        return {
          progress: current,
          recovered: false,
          persistence: isMemoryOnly ? 'memory-only' : 'persisted',
        };
      }

      // Kiểm tra quyền unlock
      const access = levelAccess(manifest, current.completed, id);
      if (!access.unlocked) {
        throw new Error(`cannot-complete-locked:${id}`);
      }

      const nextCompleted = [...current.completed, id];
      const nextProgress: Progress = {
        ...current,
        completed: nextCompleted,
      };

      return saveToStorage(nextProgress);
    },

    recordResult(id: string, elapsedMs: number, stars: Stars): ResultRecord {
      const current = readFromStorage().progress;
      const previous = current.levels[id] ?? null;
      const ms = Math.round(elapsedMs);

      const alreadyCompleted = current.completed.includes(id);
      if (!alreadyCompleted && !levelAccess(manifest, current.completed, id).unlocked) {
        throw new Error(`cannot-complete-locked:${id}`);
      }

      const improved =
        previous === null ||
        stars > previous.stars ||
        (stars === previous.stars && (previous.bestMs === null || ms < previous.bestMs));
      const best: LevelResult = improved ? { stars, bestMs: ms } : (previous as LevelResult);

      const next: Progress = {
        ...current,
        completed: alreadyCompleted ? current.completed : [...current.completed, id],
        levels: { ...current.levels, [id]: best },
      };
      return { previous, current: best, improved, load: saveToStorage(next) };
    },

    setShowTarget(show: boolean): LoadResult {
      const current = readFromStorage().progress;
      const nextProgress: Progress = {
        ...current,
        settings: {
          ...current.settings,
          showTarget: show,
        },
      };

      return saveToStorage(nextProgress);
    },

    setReducedMotion(on: boolean): LoadResult {
      const current = readFromStorage().progress;
      return saveToStorage({
        ...current,
        settings: { ...current.settings, reducedMotion: on },
      });
    },

    setHaptics(on: boolean): LoadResult {
      const current = readFromStorage().progress;
      return saveToStorage({
        ...current,
        settings: { ...current.settings, haptics: on },
      });
    },

    setMusic(on: boolean): LoadResult {
      const current = readFromStorage().progress;
      return saveToStorage({
        ...current,
        settings: { ...current.settings, music: on },
      });
    },

    setSfx(on: boolean): LoadResult {
      const current = readFromStorage().progress;
      return saveToStorage({
        ...current,
        settings: { ...current.settings, sfx: on },
      });
    },

    reset(): LoadResult {
      return saveToStorage(defaultProgress());
    },
  };
}
