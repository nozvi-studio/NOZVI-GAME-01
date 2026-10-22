/**
 * Dò các cách phủ khác của một bóng đích (exact cover) bằng bộ mảnh khác.
 *
 *   node --experimental-strip-types tools/experiments/endless-ch1/retile.ts [số màn đầu] [tối đa số mảnh]
 *
 * Chỉ đo, không ghi gì vào game.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRID_HEIGHT, GRID_WIDTH } from '../../../src/domain/model.ts';
import { buildPalette } from './generator.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = GRID_WIDTH;
const STEP = 8;

type Placement = { variant: number; x: number; y: number; cells: Int32Array };

export type Tiling = Array<{ variant: number; x: number; y: number }>;

const PALETTE = buildPalette();

export function findTilings(
  target: Uint8Array,
  minPieces: number,
  maxPieces: number,
  limit: number,
  timeMs: number
): { tilings: Tiling[]; truncated: boolean } {
  // Mọi vị trí đặt mảnh nằm trọn trong bóng, gom theo ô nhỏ nhất của mảnh
  const byMin = new Map<number, Placement[]>();
  PALETTE.forEach((v, vi) => {
    for (let y = 0; y + v.size <= GRID_HEIGHT; y += STEP) {
      for (let x = 0; x + v.size <= W; x += STEP) {
        const cells = new Int32Array(v.cells.length);
        let ok = true;
        let min = Infinity;
        for (let k = 0; k < v.cells.length; k++) {
          const idx = (y + v.cells[k][1]) * W + x + v.cells[k][0];
          if (!target[idx]) {
            ok = false;
            break;
          }
          cells[k] = idx;
          if (idx < min) min = idx;
        }
        if (!ok) continue;
        const list = byMin.get(min) ?? [];
        list.push({ variant: vi, x, y, cells });
        byMin.set(min, list);
      }
    }
  });

  let area = 0;
  for (let i = 0; i < target.length; i++) if (target[i]) area++;
  const maxArea = Math.max(...PALETTE.map((v) => v.cells.length));

  const covered = new Uint8Array(target.length);
  const stack: Tiling = [];
  const tilings: Tiling[] = [];
  const deadline = performance.now() + timeMs;
  let truncated = false;
  let first = 0;
  while (first < target.length && !target[first]) first++;

  function next(from: number): number {
    let i = from;
    while (i < target.length && (!target[i] || covered[i])) i++;
    return i;
  }

  function dfs(from: number, remaining: number): void {
    if (truncated) return;
    if (performance.now() > deadline || tilings.length >= limit) {
      truncated = true;
      return;
    }
    const cell = next(from);
    if (cell >= target.length) {
      if (stack.length >= minPieces) tilings.push(stack.slice());
      return;
    }
    if (stack.length >= maxPieces) return;
    if ((maxPieces - stack.length) * maxArea < remaining) return;
    const options = byMin.get(cell);
    if (!options) return;
    for (const p of options) {
      let free = true;
      for (let k = 0; k < p.cells.length; k++) {
        if (covered[p.cells[k]]) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      for (let k = 0; k < p.cells.length; k++) covered[p.cells[k]] = 1;
      stack.push({ variant: p.variant, x: p.x, y: p.y });
      dfs(cell + 1, remaining - p.cells.length);
      stack.pop();
      for (let k = 0; k < p.cells.length; k++) covered[p.cells[k]] = 0;
      if (truncated) return;
    }
  }
  dfs(first, area);
  return { tilings, truncated };
}

if (process.argv[1] && process.argv[1].endsWith('retile.ts')) {
  const n = Number(process.argv[2] ?? 10);
  const maxPieces = Number(process.argv[3] ?? 6);
  for (let i = 1; i <= n; i++) {
    const id = `endless-${String(i).padStart(3, '0')}`;
    const doc = JSON.parse(readFileSync(resolve(HERE, 'out/levels', `${id}.json`), 'utf8'));
    const target = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
    for (const [x, y] of doc.targetCells) target[y * W + x] = 1;
    const t0 = performance.now();
    const { tilings, truncated } = findTilings(target, 4, maxPieces, 5000, 4000);
    const byCount: Record<number, number> = {};
    for (const t of tilings) byCount[t.length] = (byCount[t.length] ?? 0) + 1;
    console.log(
      `${id}: gốc ${doc.pieces.length} mảnh · cách phủ 4–${maxPieces} mảnh: ${tilings.length}${truncated ? '+ (dừng sớm)' : ''} ${JSON.stringify(byCount)} · ${(performance.now() - t0).toFixed(0)}ms`
    );
  }
}
