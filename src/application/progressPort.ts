import type { Stars } from '../domain/starRating.ts';

export type StoragePort = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** Best result of one level: stars first, then the faster time. `bestMs` is the time of the best-star run. */
export type LevelResult = { stars: Stars; bestMs: number | null };

export type Progress = {
  version: 2;
  campaignRevision: string;
  completed: string[];
  levels: Record<string, LevelResult>;
  settings: {
    showTarget: boolean;
    reducedMotion: boolean;
    haptics: boolean;
    music: boolean;
    sfx: boolean;
  };
};

export type LoadResult = {
  progress: Progress;
  recovered: boolean;
  persistence: 'persisted' | 'memory-only';
};

export type ResultRecord = {
  previous: LevelResult | null;
  /** The stored best after this call. */
  current: LevelResult;
  /** True when this run replaced the stored best. */
  improved: boolean;
  load: LoadResult;
};

export interface ProgressRepository {
  read(): LoadResult;
  complete(id: string): LoadResult;
  /** Completes the level (if needed) and keeps the better of the stored result and this run. */
  recordResult(id: string, elapsedMs: number, stars: Stars): ResultRecord;
  setShowTarget(show: boolean): LoadResult;
  setReducedMotion(on: boolean): LoadResult;
  setHaptics(on: boolean): LoadResult;
  setMusic(on: boolean): LoadResult;
  setSfx(on: boolean): LoadResult;
  reset(): LoadResult;
}
