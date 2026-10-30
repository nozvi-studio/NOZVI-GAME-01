import type Phaser from 'phaser';

/**
 * Ngắt dòng cho chữ CJK.
 *
 * Phaser chỉ ngắt `wordWrap` tại khoảng trắng, mà tiếng Nhật không có khoảng trắng
 * nên cả câu thành một "từ" dài và tràn khỏi khung. Hàm này cho phép ngắt giữa hai
 * ký tự CJK, còn chữ Latin vẫn ngắt theo từ.
 */

const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿＀-￯]/;

/** Dấu không được đứng đầu dòng (kinsoku): ngoặc đóng, chấm câu, âm kéo dài, chữ nhỏ. */
const NO_LINE_START = /[、。，．・：；？！ー）」』】〉》〕｝ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ,.!?:;)\]}]/;

/** Dấu không được đứng cuối dòng: ngoặc mở. */
const NO_LINE_END = /[（「『【〈《〔｛([{]/;

function toUnits(line: string): string[] {
  const units: string[] = [];
  let word = '';
  const flush = (): void => {
    if (word) units.push(word);
    word = '';
  };
  for (const ch of line) {
    if (CJK.test(ch)) {
      flush();
      units.push(ch);
    } else if (ch === ' ') {
      word += ch;
      flush();
    } else {
      word += ch;
    }
  }
  flush();
  return units;
}

/** Trả về các dòng đã ngắt sao cho mỗi dòng không rộng hơn `maxWidth` (trừ một ký tự đơn quá rộng). */
export function wrapCjk(
  text: string,
  maxWidth: number,
  measure: (s: string) => number
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const unit of toUnits(paragraph)) {
      const candidate = line + unit;
      const fits = measure(candidate.trimEnd()) <= maxWidth;
      const holdsPunct = NO_LINE_START.test(unit[0]) && line !== '';
      const holdsOpener = line !== '' && NO_LINE_END.test(line[line.length - 1]);
      if (fits || line === '' || holdsPunct || holdsOpener) {
        line = candidate;
      } else {
        out.push(line.trimEnd());
        line = unit.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** `wordWrap` cho Phaser.Text: `{ width, callback: cjkWordWrapCallback(width) }`. */
export function cjkWordWrapCallback(
  maxWidth: number
): (this: unknown, text: string, textObject: Phaser.GameObjects.Text) => string {
  return (text, textObject) =>
    wrapCjk(text, maxWidth, (s) => textObject.context.measureText(s).width).join('\n');
}
