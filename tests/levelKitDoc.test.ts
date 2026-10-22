import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { GALLERY, galleryFileName } from '../scripts/content/render-kit-gallery.ts';

const DOC = fileURLToPath(new URL('../docs/content/level-kit.md', import.meta.url));
const KIT_DIR = fileURLToPath(new URL('../docs/content/kit/', import.meta.url));

describe('docs/content/level-kit.md', () => {
  test('bảng hình có đủ 15 hướng', () => {
    expect(GALLERY.flatMap((g) => g.orientations.map((o) => galleryFileName(g.kind, o)))).toHaveLength(15);
  });

  test('trỏ tới mọi ảnh hình và ảnh đã được sinh', () => {
    const md = readFileSync(DOC, 'utf8');
    for (const g of GALLERY) {
      for (const o of g.orientations) {
        const file = galleryFileName(g.kind, o);
        expect(md).toContain(`kit/${file}`);
        expect(existsSync(KIT_DIR + file)).toBe(true);
      }
    }
  });

  test('đủ sáu mục của spec B mục 4 và ba màn mẫu', () => {
    const md = readFileSync(DOC, 'utf8');
    for (const heading of [
      '## 1. Bảng hình',
      '## 2. Lưới và toạ độ',
      '## 3. Luật chẵn lẻ',
      '## 4. Quy trình tạo màn',
      '## 5. Ba màn mẫu để clone',
      '## 6. Mẹo tăng độ khó',
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('### 1-2 Bảo Tháp Tiên Tri');
    expect(md).toContain('### 2-3 Trái Tim Tinh Thể');
    expect(md).toContain('### 3-10 Mandala Thiên Cầu');
    expect(md).toContain('npm run content:new');
    expect(md).toContain('mirrorX(');
    expect(md).toContain('concentric(');
  });
});
