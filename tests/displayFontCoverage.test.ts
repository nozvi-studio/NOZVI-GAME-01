import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TYPO_TOKENS } from '../src/presentation/designTokens.ts';
import { MENU_TAGLINES, TRANSLATIONS } from '../src/presentation/i18n.ts';
import jaCommon from '../src/locales/ja/common.json';
import jaGame from '../src/locales/ja/game.json';

/**
 * Canh cho font hiển thị phủ được mọi chuỗi giao diện.
 *
 * Lý do có file này: bản trước dùng Fredoka, mà Google Fonts chỉ phát hành
 * Fredoka với subset hebrew/latin/latin-ext — không có vietnamese. Dải
 * U+1EA0–1EF1 rơi ra ngoài, nên "Bắt đầu" được vẽ nửa Fredoka nửa font hệ
 * thống, lệch ngay giữa từ. Lỗi này không làm hỏng build, không làm rớt test
 * nào, và chỉ lộ ra khi nhìn thiết bị thật — nên phải có thứ canh tự động.
 */

const CSS = readFileSync(new URL('../src/style.css', import.meta.url), 'utf-8');

/** Tên họ chữ đầu tiên trong chuỗi font-family, ví dụ "'Baloo 2', ..." -> Baloo 2 */
function primaryFamily(stack: string): string {
  const first = stack.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}

/** Mọi khoảng unicode mà các @font-face của một họ chữ khai báo trong style.css */
function declaredRanges(family: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  for (const block of CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = block[1];
    if (!new RegExp(`font-family:\\s*['"]${family}['"]`).test(body)) continue;

    const raw = /unicode-range:\s*([^;]+);/.exec(body);
    if (!raw) {
      // Không khai báo unicode-range nghĩa là phủ toàn bộ.
      ranges.push([0, 0x10ffff]);
      continue;
    }

    for (const part of raw[1].split(',')) {
      const token = part.trim().replace(/^U\+/i, '');
      const [from, to] = token.split('-');
      ranges.push([Number.parseInt(from, 16), Number.parseInt(to ?? from, 16)]);
    }
  }

  return ranges;
}

function uncovered(text: string, ranges: Array<[number, number]>): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (!ch.trim()) continue;
    const cp = ch.codePointAt(0)!;
    if (!ranges.some(([a, b]) => cp >= a && cp <= b)) missing.add(ch);
  }
  return [...missing];
}

const DISPLAY_FAMILY = primaryFamily(TYPO_TOKENS.fontFamily.display);
const DISPLAY_RANGES = declaredRanges(DISPLAY_FAMILY);

describe(`font hiển thị (${DISPLAY_FAMILY})`, () => {
  it('được khai báo trong style.css', () => {
    expect(DISPLAY_RANGES.length).toBeGreaterThan(0);
  });

  it('phủ dải nguyên âm có dấu của tiếng Việt (U+1EA0–1EF9)', () => {
    const uncoveredPoints: string[] = [];
    for (let cp = 0x1ea0; cp <= 0x1ef9; cp++) {
      if (!DISPLAY_RANGES.some(([a, b]) => cp >= a && cp <= b)) {
        uncoveredPoints.push(String.fromCodePoint(cp));
      }
    }
    expect(uncoveredPoints).toEqual([]);
  });

  it.each(Object.entries(TRANSLATIONS.vi))('phủ trọn chuỗi tiếng Việt %s', (_key, text) => {
    expect(uncovered(text, DISPLAY_RANGES)).toEqual([]);
  });

  it.each(Object.entries(TRANSLATIONS.en))('phủ trọn chuỗi tiếng Anh %s', (_key, text) => {
    expect(uncovered(text, DISPLAY_RANGES)).toEqual([]);
  });

  // Phụ đề menu bốc ngẫu nhiên nên mọi câu đều phải vẽ được bằng font hiển thị.
  it.each(MENU_TAGLINES.vi)('phủ trọn mẩu thiên văn tiếng Việt "%s"', (text) => {
    expect(uncovered(text, DISPLAY_RANGES)).toEqual([]);
  });

  it.each(MENU_TAGLINES.en)('phủ trọn mẩu thiên văn tiếng Anh "%s"', (text) => {
    expect(uncovered(text, DISPLAY_RANGES)).toEqual([]);
  });
});

describe('font thân chữ (Be Vietnam Pro)', () => {
  it('cũng phủ dải nguyên âm có dấu', () => {
    const ranges = declaredRanges(primaryFamily(TYPO_TOKENS.fontFamily.sans));
    expect(ranges.length).toBeGreaterThan(0);
    for (const ch of 'ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữự') {
      expect(uncovered(ch, ranges)).toEqual([]);
    }
  });
});

describe('Typography & CJK Font Fallback', () => {
  it('fontFamily includes Japanese system CJK font stack', () => {
    expect(TYPO_TOKENS.fontFamily.display).toContain('Hiragino Sans');
    expect(TYPO_TOKENS.fontFamily.display).toContain('Noto Sans CJK JP');
    expect(TYPO_TOKENS.fontFamily.display).toContain('Yu Gothic');
    expect(TYPO_TOKENS.fontFamily.sans).toContain('Hiragino Sans');
  });

  it('Japanese translation strings contain valid CJK and kana characters', () => {
    const sample = jaCommon.btn_start + jaCommon.pause_title + (jaGame.chapters as Record<string, string>)['1'];
    expect(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(sample)).toBe(true);
  });
});

