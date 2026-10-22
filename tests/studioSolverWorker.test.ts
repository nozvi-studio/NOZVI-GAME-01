import { describe, expect, test } from 'vitest';
import { levelTemplate } from '../src/content/sources/_template.ts';
import { handleCheck } from '../src/studio/solverWorker.ts';

describe('solverWorker - handleCheck (spec E, ST-04, Quyết định 1)', () => {
  test('chạy authorLevel trên levelTemplate trả về kết quả hợp lệ', () => {
    const res = handleCheck(levelTemplate);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.report.solutionCount).toBe(1);
      expect(res.report.fewerPieceSolutions).toBe(0);
      expect(res.score.score).toBeGreaterThanOrEqual(1);
      expect(res.score.score).toBeLessThanOrEqual(5);
      expect(res.svg).toContain('<svg');
    }
  });

  test('nguồn không hợp lệ trả về ok: false kèm issues', () => {
    const badSource = {
      ...levelTemplate,
      pieces: [],
    };
    const res = handleCheck(badSource);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.length).toBeGreaterThan(0);
    }
  });
});
