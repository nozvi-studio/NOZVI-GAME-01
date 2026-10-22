import { describe, expect, it } from 'vitest';
import { wrapCjk } from '../src/presentation/cjkWrap.ts';

// 1 ký tự = 10 px
const measure = (s: string): number => s.length * 10;

describe('wrapCjk', () => {
  it('breaks Japanese text that has no spaces', () => {
    const lines = wrapCjk('星々が集う場所へようこそ', 50, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe('星々が集う場所へようこそ');
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(50);
  });

  it('keeps closing punctuation off the start of a line', () => {
    const lines = wrapCjk('あいうえお。かきくけこ', 50, measure);
    expect(lines[0]).toBe('あいうえお。');
    for (const l of lines.slice(1)) expect(l[0]).not.toBe('。');
  });

  it('still wraps Latin text by word', () => {
    expect(wrapCjk('aaa bbb ccc', 70, measure)).toEqual(['aaa bbb', 'ccc']);
  });
});
