import type { LevelSource } from '../content/authoring.ts';
import { authorLevel } from '../content/authorLevel.ts';
import type { AuthorResult } from '../content/authorLevel.ts';

export type CheckWorkerRequest = {
  seq: number;
  source: LevelSource;
};

export type CheckWorkerResponse = {
  seq: number;
  result: AuthorResult;
};

/**
 * Xử lý kiểm tra màn bằng authorLevel trong bộ nhớ (spec E, ST-04, Quyết định 1).
 */
export function handleCheck(source: LevelSource): AuthorResult {
  return authorLevel(source);
}

// Chạy trong môi trường Web Worker
if (
  typeof self !== 'undefined' &&
  typeof (self as any).postMessage === 'function' &&
  typeof window === 'undefined'
) {
  self.onmessage = (event: MessageEvent<CheckWorkerRequest>) => {
    const { seq, source } = event.data;
    const result = handleCheck(source);
    self.postMessage({ seq, result } satisfies CheckWorkerResponse);
  };
}
