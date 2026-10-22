import { describe, it, expect, beforeEach } from 'vitest';
import { shuffleIndices } from '../src/domain/cosmicFacts.ts';
import { createCosmicFactRepository } from '../src/infrastructure/cosmicFactRepository.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

function createMemoryStorage(): StoragePort {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}

describe('shuffleIndices', () => {
  it('returns all indices from 0 to N-1 without duplicates', () => {
    const list = shuffleIndices(15);
    expect(list.length).toBe(15);
    expect(new Set(list).size).toBe(15);
    for (let i = 0; i < 15; i++) {
      expect(list.includes(i)).toBe(true);
    }
  });

  it('ensures first index differs from previousLast when N > 1', () => {
    for (let test = 0; test < 50; test++) {
      const list = shuffleIndices(5, 2);
      expect(list[0]).not.toBe(2);
      expect(list.length).toBe(5);
      expect(new Set(list).size).toBe(5);
    }
  });

  it('supports injectable deterministic RNG', () => {
    // Constant RNG returning 0 reverses or keeps order deterministically
    const deterministicRng = () => 0;
    const list = shuffleIndices(4, undefined, deterministicRng);
    expect(list.length).toBe(4);
    expect(new Set(list).size).toBe(4);
  });
});

describe('CosmicFactRepository', () => {
  let storage: StoragePort;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('cycles through all indices before repeating', () => {
    const repo = createCosmicFactRepository(storage);
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(repo.nextFactIndex(1, 5));
    }
    expect(new Set(seen).size).toBe(5);
  });

  it('peekFactIndex returns current index without advancing', () => {
    const repo = createCosmicFactRepository(storage);
    const peek1 = repo.peekFactIndex(1, 5);
    const peek2 = repo.peekFactIndex(1, 5);
    expect(peek1).toBe(peek2);
    const next = repo.nextFactIndex(1, 5);
    expect(next).toBe(peek1);
  });

  it('persists progress across repository instances with the same storage', () => {
    const repo1 = createCosmicFactRepository(storage);
    const first = repo1.nextFactIndex(1, 10);
    const second = repo1.nextFactIndex(1, 10);

    const repo2 = createCosmicFactRepository(storage);
    const third = repo2.nextFactIndex(1, 10);

    expect(new Set([first, second, third]).size).toBe(3);
  });

  it('recovers cleanly from corrupt stored JSON and continues persisting', () => {
    storage.setItem('nozvi.cosmic_facts.v1', '{corrupt-json');
    const repo = createCosmicFactRepository(storage);
    const idx1 = repo.nextFactIndex(1, 5);
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx1).toBeLessThan(5);

    // Verify storage was overwritten with valid JSON rather than broken forever
    const raw = storage.getItem('nozvi.cosmic_facts.v1');
    expect(raw).toBeTruthy();
    expect(() => JSON.parse(raw!)).not.toThrow();

    // Verify next call progresses persisted state
    const repo2 = createCosmicFactRepository(storage);
    const idx2 = repo2.nextFactIndex(1, 5);
    expect(idx2).not.toBe(idx1);
  });

  it('handles null chapters or invalid state safely without throwing', () => {
    storage.setItem('nozvi.cosmic_facts.v1', JSON.stringify({ version: 1, chapters: null }));
    const repo = createCosmicFactRepository(storage);
    expect(() => repo.nextFactIndex(1, 5)).not.toThrow();
  });

  it('reset() resets state and stores valid empty state', () => {
    const repo = createCosmicFactRepository(storage);
    repo.nextFactIndex(1, 5);
    repo.reset();
    const raw = storage.getItem('nozvi.cosmic_facts.v1');
    expect(raw).toBe(JSON.stringify({ version: 1, chapters: {} }));
  });
});
