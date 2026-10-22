/** Storage getters can throw SecurityError in restricted browser embeds. */
export function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined') return window.localStorage ?? null;
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// Shared across repositories so progress survives scene changes without persistence.
const memory = new Map<string, string>();
export const memoryStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
};
