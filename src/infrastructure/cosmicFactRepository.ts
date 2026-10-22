import type { StoragePort } from '../application/progressPort.ts';
import { shuffleIndices } from '../domain/cosmicFacts.ts';

const COSMIC_FACTS_STORAGE_KEY = 'nozvi.cosmic_facts.v1';

export interface ChapterShuffleState {
  order: number[];
  index: number;
  lastVerseIndex?: number;
}

export interface CosmicFactsState {
  version: 1;
  chapters: Record<string, ChapterShuffleState>;
}

export interface CosmicFactRepository {
  nextFactIndex(chapter: number, poolSize: number): number;
  peekFactIndex(chapter: number, poolSize: number): number;
  reset(): void;
}

function isValidChapterState(parsed: unknown, expectedSize: number): parsed is ChapterShuffleState {
  if (!parsed || typeof parsed !== 'object') return false;
  const ch = parsed as Record<string, unknown>;
  if (!Array.isArray(ch.order) || ch.order.length !== expectedSize) return false;
  if (typeof ch.index !== 'number' || !Number.isInteger(ch.index) || ch.index < 0 || ch.index >= expectedSize) {
    return false;
  }
  const set = new Set<number>();
  for (const item of ch.order) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item >= expectedSize) {
      return false;
    }
    set.add(item);
  }
  return set.size === expectedSize;
}

export function createCosmicFactRepository(
  storage: StoragePort,
  rng: () => number = Math.random
): CosmicFactRepository {
  let memorySnapshot: CosmicFactsState = {
    version: 1,
    chapters: {},
  };
  let isMemoryOnly = false;

  function loadState(): CosmicFactsState {
    if (isMemoryOnly) return memorySnapshot;
    let raw: string | null = null;
    try {
      raw = storage.getItem(COSMIC_FACTS_STORAGE_KEY);
    } catch {
      isMemoryOnly = true;
      return memorySnapshot;
    }

    if (!raw) return memorySnapshot;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupt JSON string: reset state and continue persisting
      const fresh: CosmicFactsState = { version: 1, chapters: {} };
      memorySnapshot = fresh;
      saveState(fresh);
      return memorySnapshot;
    }

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).version === 1 &&
      Boolean((parsed as Record<string, unknown>).chapters) &&
      typeof (parsed as Record<string, unknown>).chapters === 'object' &&
      !Array.isArray((parsed as Record<string, unknown>).chapters)
    ) {
      memorySnapshot = parsed as CosmicFactsState;
      return memorySnapshot;
    }

    // Schema mismatch or corrupt content: reset state and continue persisting
    const fresh: CosmicFactsState = { version: 1, chapters: {} };
    memorySnapshot = fresh;
    saveState(fresh);
    return memorySnapshot;
  }

  function saveState(state: CosmicFactsState): void {
    memorySnapshot = state;
    if (isMemoryOnly) return;
    try {
      storage.setItem(COSMIC_FACTS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      isMemoryOnly = true;
    }
  }

  function ensureChapterState(state: CosmicFactsState, chapter: number, poolSize: number): ChapterShuffleState {
    const chKey = String(chapter);
    const existingRaw: unknown = state.chapters[chKey];
    const lastVerseIndex =
      existingRaw && typeof existingRaw === 'object' && 'lastVerseIndex' in existingRaw && typeof (existingRaw as Record<string, unknown>).lastVerseIndex === 'number'
        ? ((existingRaw as Record<string, unknown>).lastVerseIndex as number)
        : undefined;

    if (!isValidChapterState(existingRaw, poolSize)) {
      const order = shuffleIndices(poolSize, lastVerseIndex, rng);
      const chState: ChapterShuffleState = {
        order,
        index: 0,
        lastVerseIndex,
      };
      state.chapters[chKey] = chState;
      saveState(state);
      return chState;
    }
    return existingRaw;
  }

  return {
    nextFactIndex(chapter: number, poolSize: number): number {
      if (poolSize <= 0) return 0;
      const state = loadState();
      let chState = ensureChapterState(state, chapter, poolSize);

      if (chState.index >= chState.order.length) {
        const order = shuffleIndices(poolSize, chState.lastVerseIndex, rng);
        chState = {
          order,
          index: 0,
          lastVerseIndex: chState.lastVerseIndex,
        };
        state.chapters[String(chapter)] = chState;
      }

      const chosen = chState.order[chState.index];
      chState.lastVerseIndex = chosen;
      chState.index += 1;
      saveState(state);

      return chosen;
    },

    peekFactIndex(chapter: number, poolSize: number): number {
      if (poolSize <= 0) return 0;
      const state = loadState();
      const chState = ensureChapterState(state, chapter, poolSize);
      return chState.order[chState.index] ?? 0;
    },

    reset(): void {
      const fresh: CosmicFactsState = { version: 1, chapters: {} };
      memorySnapshot = fresh;
      saveState(fresh);
    },
  };
}
