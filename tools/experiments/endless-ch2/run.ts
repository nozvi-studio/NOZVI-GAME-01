/**
 * Script chạy thử nghiệm sinh màn Endless Chương 2 (Giao Thoa HSR).
 *
 * Cách chạy:
 *   node --experimental-strip-types tools/experiments/endless-ch2/run.ts --count 10 --seed 1 --install
 *   node --experimental-strip-types tools/experiments/endless-ch2/run.ts --clean
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPreviewSvg } from '../../../src/content/authoringReport.ts';
import { renderGalleryPage } from './galleryPage.ts';
import { generateChapter2Level } from './generator.ts';
import type { Generated } from './generator.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const LEVELS_OUT = resolve(OUT, 'levels');
const STUDIO = resolve(HERE, '../../../src/content/studio/levels');

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

if (has('clean')) {
  if (existsSync(STUDIO)) {
    for (const f of readdirSync(STUDIO)) {
      if (f.startsWith('endless-ch2-')) rmSync(resolve(STUDIO, f));
    }
  }
  console.log('[endless-ch2] Đã xoá các màn endless-ch2-* trong studio/levels');
  process.exit(0);
}

const count = arg('count', 10);
const seed0 = arg('seed', 1);
const maxAttempts = count * 600;

console.log(`[endless-ch2] Bắt đầu sinh ${count} màn Chương 2 từ seed ${seed0}...`);

mkdirSync(LEVELS_OUT, { recursive: true });
if (!existsSync(STUDIO)) mkdirSync(STUDIO, { recursive: true });

const started = performance.now();
const kept: Generated[] = [];
const seen = new Set<string>();
let tried = 0;
let duplicates = 0;

for (let s = seed0; kept.length < count && tried < maxAttempts; s++) {
  tried++;
  const n = kept.length + 1;
  const id = `endless-ch2-${String(n).padStart(3, '0')}`;
  const gen = generateChapter2Level(s, id, n);
  if (!gen) continue;

  if (seen.has(gen.silhouetteKey)) {
    duplicates++;
    continue;
  }
  seen.add(gen.silhouetteKey);
  kept.push(gen);

  const st = gen.stats;
  console.log(
    `[endless-ch2] [${kept.length}/${count}] #${id} (${st.archetype}): ${st.pieces} mảnh, ${st.decoys} neo nhiễu, ${st.threeLayerSpots} hạt nhân 3-tầng, khó ${st.difficultyEstimate} (thử ${tried} lần)`
  );
}

const elapsedMs = Math.round(performance.now() - started);
console.log(`[endless-ch2] Hoàn tất: sinh được ${kept.length}/${count} màn trong ${elapsedMs}ms (${tried} lượt thử, ${duplicates} trùng).`);

// Ghi file JSON và SVG
const cards: string[] = [];
for (const gen of kept) {
  const doc = gen.result.doc;
  const jsonPath = resolve(LEVELS_OUT, `${doc.id}.json`);
  writeFileSync(jsonPath, gen.result.json, 'utf-8');

  const svg = renderPreviewSvg(doc);
  const svgPath = resolve(LEVELS_OUT, `${doc.id}.svg`);
  writeFileSync(svgPath, svg, 'utf-8');

  if (has('install')) {
    copyFileSync(jsonPath, resolve(STUDIO, `${doc.id}.json`));
  }

  const st = gen.stats;
  cards.push(
    `<figure data-level="${doc.order}" data-id="${doc.id}" data-title="${doc.title}">
      <div class="svg">${svg}</div>
      <figcaption>
        <span class="archetype">${st.archetype}</span><br>
        <strong>${doc.id} · ${doc.title}</strong><br>
        ${st.pieces} mảnh · ${st.decoys} neo nhiễu · ${st.threeLayerSpots} điểm 3-tầng · Độ khó ${st.difficultyEstimate}
      </figcaption>
    </figure>`
  );
}

// Ghi gallery.html
const galleryHtml = renderGalleryPage(cards.join('\n'), kept.length);
writeFileSync(resolve(OUT, 'gallery.html'), galleryHtml, 'utf-8');

// Ghi report.md
const reportLines: string[] = [
  '# Báo cáo Thử nghiệm Endless Chương 2 (Giao Thoa HSR)',
  '',
  `- **Tổng số màn sinh thành công**: ${kept.length}`,
  `- **Thời gian thực thi**: ${elapsedMs} ms`,
  `- **Số lượt thử**: ${tried}`,
  `- **Tất cả các màn đều được kiểm chứng 1 nghiệm duy nhất** (\`proven === true\`, \`solutionCount === 1\`, \`fewerPieceSolutions === 0\`).`,
  '',
  '| ID | Tiêu đề | Archetype | Số mảnh | Số neo nhiễu | Điểm 3 tầng | Độ khó |',
  '|----|---------|-----------|---------|--------------|-------------|--------|',
];

for (const gen of kept) {
  const st = gen.stats;
  reportLines.push(
    `| ${gen.source.id} | ${gen.source.title} | \`${st.archetype}\` | ${st.pieces} | ${st.decoys} | ${st.threeLayerSpots} | ${st.difficultyEstimate} |`
  );
}

writeFileSync(resolve(OUT, 'report.md'), reportLines.join('\n'), 'utf-8');
console.log(`[endless-ch2] Đã xuất kết quả ra ${OUT}/`);
if (has('install')) {
  console.log(`[endless-ch2] Đã cài đặt ${kept.length} màn vào src/content/studio/levels/ để chơi thử ngay trong harness.`);
}
