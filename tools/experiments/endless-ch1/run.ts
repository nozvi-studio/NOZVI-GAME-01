/**
 * Chạy thử nghiệm sinh màn Endless Chương 1.
 *
 *   node --experimental-strip-types tools/experiments/endless-ch1/run.ts --count 50 --seed 1
 *   ... --install   chép JSON vào src/content/studio/levels/ để chơi ở harness
 *   ... --clean     xoá các màn endless-*.json đã chép
 *
 * Ghi ra tools/experiments/endless-ch1/out/: levels/*.json, gallery.html, report.md, pool.json
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPreviewSvg } from '../../../src/content/authoringReport.ts';
import { renderGalleryPage } from './galleryPage.ts';
import { diversityOf, generateFromPlaced, generateLevel, mulberry32, placedFromTiling } from './generator.ts';
import { findTilings } from './retile.ts';
import type { Generated } from './generator.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'out');
const STUDIO = resolve(HERE, '../../../src/content/studio/levels');

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

if (has('clean')) {
  for (const f of readdirSync(STUDIO)) {
    if (/^endless-\d{3}\.json$/.test(f)) rmSync(resolve(STUDIO, f));
  }
  console.log('[endless] đã xoá các màn endless-* trong studio/levels');
  process.exit(0);
}

const modeIdx = process.argv.indexOf('--mode');
const mode = modeIdx >= 0 && process.argv[modeIdx + 1] === 'free' ? 'free' : 'sym';
const count = arg('count', 50);
const seed0 = arg('seed', 1);
const extra = arg('extra', 0);
// Chỉ bóng có đủ nhiều cách phủ mới được lặp; bóng ít cách phủ giữ đúng 1 màn
const minTilings = arg('min-tilings', 12);
/** Số màn lặp tối đa của một bóng, tăng theo số cách phủ của nó. */
const capFor = (total: number): number => (total < minTilings ? 0 : total < 25 ? 2 : total < 60 ? 3 : 4);
const maxCandidates = count * 400;

const started = performance.now();
const kept: Generated[] = [];
const seen = new Set<string>();
let tried = 0;
let failed = 0;
let duplicate = 0;

for (let s = seed0; kept.length < count && tried < maxCandidates; s++) {
  tried++;
  const n = kept.length + 1;
  const id = `endless-${String(n).padStart(3, '0')}`;
  const gen = generateLevel(s, id, n, mode);
  if (!gen) {
    failed++;
    continue;
  }
  if (seen.has(gen.silhouetteKey)) {
    duplicate++;
    continue;
  }
  seen.add(gen.silhouetteKey);
  kept.push(gen);
}
const baseCount = kept.length;
const elapsed = performance.now() - started;

// Màn dựng lại: cùng bóng, bộ mảnh khác (ưu tiên đa dạng hình), chọn luân phiên giữa các bóng
let extraTried = 0;
let extraKept = 0;
if (extra > 0) {
  const rng = mulberry32(seed0 * 7919);
  const pieceKey = (parts: string[]): string => parts.slice().sort().join('|');
  const queues = kept.slice().map((g) => {
    const doc = g.result.doc;
    const target = new Uint8Array(128 * 160);
    for (const [x, y] of doc.targetCells) target[y * 128 + x] = 1;
    const own = pieceKey(
      g.source.pieces.map((p) => `${p.shapeKind}${p.orientation}${p.frameSize}@${p.anchors[0].x},${p.anchors[0].y}`)
    );
    const { tilings } = findTilings(target, 4, 6, 5000, 4000);
    const queue = tilings
      .map((t) => placedFromTiling(t))
      .filter(
        (pl) => pieceKey(pl.map((p) => `${p.variant.kind}${p.variant.orientation}${p.variant.size}@${p.x},${p.y}`)) !== own
      )
      .map((pl) => ({ pl, score: diversityOf(pl) + rng() }))
      .sort((a, b) => b.score - a.score);
    return { queue, cap: capFor(tilings.length), total: tilings.length };
  });
  const perSilhouette = new Array(queues.length).fill(0);
  const eligible = queues.filter((q) => q.cap > 0).length;
  console.log(`[endless] bóng đủ điều kiện lặp (>= ${minTilings} cách phủ): ${eligible}/${queues.length}`);
  for (let round = 0; round < 40 && extraKept < extra; round++) {
    for (let i = 0; i < queues.length && extraKept < extra; i++) {
      if (perSilhouette[i] >= queues[i].cap) continue;
      // lấy phương án tốt nhất còn lại của bóng này cho tới khi một cái qua cổng
      while (queues[i].queue.length > 0 && perSilhouette[i] <= round) {
        const cand = queues[i].queue.shift();
        if (!cand) break;
        extraTried++;
        const n = kept.length + 1;
        const gen = generateFromPlaced(cand.pl, rng, `endless-${String(n).padStart(3, '0')}`, n);
        if (!gen) continue;
        kept.push(gen);
        perSilhouette[i]++;
        extraKept++;
      }
    }
  }
}


mkdirSync(resolve(OUT, 'levels'), { recursive: true });
for (const f of readdirSync(resolve(OUT, 'levels'))) rmSync(resolve(OUT, 'levels', f));
for (const g of kept) writeFileSync(resolve(OUT, 'levels', `${g.result.doc.id}.json`), g.result.json, 'utf8');
writeFileSync(resolve(OUT, 'pool.json'), JSON.stringify(kept.map((g) => g.source)), 'utf8');

// Gallery để xem lướt
const dist = [0, 0, 0, 0, 0, 0];
const cards = kept
  .map((g, i) => {
    dist[g.result.score.score]++;
    const d = g.result.doc;
    return `<figure data-chapter="1" data-level="${i + 1}" data-id="${d.id}" tabindex="0"><div class="svg">${renderPreviewSvg(d)}</div><figcaption><b>Màn ${i + 1}</b> · ${g.stats.pieces} mảnh · khó ${g.result.score.score}</figcaption></figure>`;
  })
  .join('\n');
writeFileSync(
  resolve(OUT, 'index.json'),
  JSON.stringify(
    kept.map((g) => ({ id: g.result.doc.id, pieces: g.stats.pieces, difficulty: g.result.score.score }))
  ),
  'utf8'
);
writeFileSync(resolve(OUT, 'gallery.html'), renderGalleryPage(cards, kept.length), 'utf8');

const pieceHist: Record<number, number> = {};
let decoys = 0;
for (const g of kept) {
  pieceHist[g.stats.pieces] = (pieceHist[g.stats.pieces] ?? 0) + 1;
  decoys += g.stats.decoys;
}
const report = [
  `# Endless Ch1 lab`,
  ``,
  `- Seed bắt đầu: ${seed0}`,
  `- Ứng viên đã thử: ${tried}, rớt cổng: ${failed}, trùng bóng: ${duplicate}, giữ: ${baseCount} (tổng sau khi dựng lại: ${kept.length})`,
  `- Tỉ lệ qua cổng: ${(((baseCount + duplicate) / tried) * 100).toFixed(1)}%`,
  `- Thời gian: ${(elapsed / 1000).toFixed(1)}s tổng, ${(elapsed / tried).toFixed(0)}ms mỗi ứng viên`,
  `- Màn dựng lại từ cách phủ khác: thử ${extraTried}, giữ ${extraKept}
- Số mảnh: ${JSON.stringify(pieceHist)}`,
  `- Neo nhiễu trung bình mỗi màn: ${(decoys / Math.max(1, kept.length)).toFixed(1)}`,
  `- Phân bố độ khó (1..5): ${dist.slice(1).join(' / ')}`,
  ``,
].join('\n');
writeFileSync(resolve(OUT, 'report.md'), report, 'utf8');
console.log(report);

if (has('install')) {
  if (!existsSync(STUDIO)) throw new Error('không thấy studio/levels');
  for (const f of readdirSync(STUDIO)) if (f.startsWith('endless-')) rmSync(resolve(STUDIO, f));
  for (const g of kept) {
    const f = `${g.result.doc.id}.json`;
    copyFileSync(resolve(OUT, 'levels', f), resolve(STUDIO, f));
  }
  console.log(`[endless] đã chép ${kept.length} màn vào src/content/studio/levels/`);
}
