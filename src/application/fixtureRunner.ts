import type { Level, PuzzleState } from '../domain/model.ts';
import { makeAdjacentFixture } from '../content/fixtures.ts';
import { validateLevel } from '../content/validate.ts';
import { applyCommand, createPuzzle } from '../domain/session.ts';

export type FixtureResult = {
  level: Level;
  state: PuzzleState;
  mask: Uint8Array;
};

/**
 * Chạy giải pháp nghiệm chuẩn của technical fixture M0 (2 thoi tiếp giáp đỉnh).
 */
export function runFixtureSolution(): FixtureResult {
  const doc = makeAdjacentFixture();
  const validation = validateLevel(doc);
  if (!validation.ok) {
    throw new Error(`Technical fixture validation failed: ${JSON.stringify(validation.issues)}`);
  }
  const level = validation.level;

  let state = createPuzzle(level);
  // D1 neo A: (24, 76)
  const res1 = applyCommand(level, state, { type: 'drop', pieceId: 'D1', x: 24, y: 76 });
  // D2 neo A: (64, 76)
  const res2 = applyCommand(level, res1.state, { type: 'drop', pieceId: 'D2', x: 64, y: 76 });

  return {
    level,
    state: res2.state,
    mask: res2.mask,
  };
}
