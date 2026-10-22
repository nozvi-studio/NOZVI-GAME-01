import { describe, expect, test } from 'vitest';
import { runFixtureSolution } from '../src/application/fixtureRunner.ts';

describe('Technical Fixture Harness', () => {
  test('chạy nghiệm chuẩn fixture dẫn tới trạng thái won và mask khớp 100% targetMask', () => {
    const result = runFixtureSolution();
    expect(result.state.phase).toBe('won');
    expect(result.mask).toEqual(result.level.targetMask);
  });
});
