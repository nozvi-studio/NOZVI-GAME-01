/**
 * Thử nghiệm Endless Chương 1 (spec 2026-10-08-ch1-endless-tangram-generator).
 * Tách riêng khỏi game: chỉ import đọc từ src/, không file nào trong src/ import lại.
 *
 * Cách làm đơn giản, không tối ưu:
 *   1. Ghép 4–6 mảnh sát cạnh nhau trên mask ô (cấm chồng).
 *   2. Thêm neo nhiễu lần lượt, giữ neo nào mà bộ giải vẫn báo đúng 1 nghiệm.
 *   3. Chạy cả đường authorLevel (validate + giải + chấm độ khó) làm cổng cuối.
 */
import type { Orientation, ShapeKind } from '../../../src/domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../../../src/domain/model.ts';
import { isValidFrame, mirrorOrientation, shapeCells } from '../../../src/domain/shapes.ts';
import { anchorFitsBoard, buildLevelDocument } from '../../../src/content/authoring.ts';
import type { LevelSource, PieceSource } from '../../../src/content/authoring.ts';
import { authorLevel } from '../../../src/content/authorLevel.ts';
import type { AuthorResult } from '../../../src/content/authorLevel.ts';
import { solveLevel } from '../../../src/content/solver.ts';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Variant = {
  kind: ShapeKind;
  orientation: Orientation;
  size: number;
  cells: ReadonlyArray<readonly [number, number]>;
  weight: number;
};

const STEP = 8;
/** Mảnh phải nằm trong vùng đệm của bàn. */
const MARGIN = 8;
/** Số ô chạm tối thiểu để tính là "ghép cạnh". */
const MIN_CONTACT = 16;

const PALETTE_SPEC: Array<{ kind: ShapeKind; orientations: Orientation[]; sizes: number[]; weight: number }> = [
  { kind: 'square', orientations: [0], sizes: [16, 24, 32, 48], weight: 2 },
  { kind: 'triangle', orientations: [0, 1, 2, 3], sizes: [16, 24, 32, 48], weight: 2 },
  { kind: 'triangle', orientations: [4, 5, 6, 7], sizes: [32, 48], weight: 2 },
  { kind: 'parallelogram', orientations: [0, 1, 2, 3], sizes: [24, 48], weight: 3 },
  { kind: 'diamond', orientations: [0], sizes: [16, 32, 48], weight: 3 },
];

/** Palette dựng từ isValidFrame nên đổi luật khung thì tự đúng theo. */
export function buildPalette(): Variant[] {
  const out: Variant[] = [];
  for (const spec of PALETTE_SPEC) {
    for (const orientation of spec.orientations) {
      for (const size of spec.sizes) {
        if (!isValidFrame(spec.kind, orientation, size)) continue;
        out.push({
          kind: spec.kind,
          orientation,
          size,
          cells: shapeCells(spec.kind, orientation, size),
          weight: spec.weight,
        });
      }
    }
  }
  return out;
}

const PALETTE = buildPalette();

function pickWeighted<T>(items: readonly T[], weightOf: (t: T) => number, rng: Rng): T {
  let total = 0;
  for (const item of items) total += weightOf(item);
  let r = rng() * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

export type Placed = { variant: Variant; x: number; y: number };

type Candidate = { x: number; y: number; contact: number };

function candidatesFor(
  variant: Variant,
  acc: Uint8Array,
  bounds: { x0: number; y0: number; x1: number; y1: number }
): Candidate[] {
  const out: Candidate[] = [];
  const xMin = Math.max(0, Math.floor((bounds.x0 - variant.size) / STEP) * STEP);
  const xMax = Math.min(GRID_WIDTH - variant.size, bounds.x1);
  const yMin = Math.max(0, Math.floor((bounds.y0 - variant.size) / STEP) * STEP);
  const yMax = Math.min(GRID_HEIGHT - variant.size, bounds.y1);
  for (let y = yMin; y <= yMax; y += STEP) {
    for (let x = xMin; x <= xMax; x += STEP) {
      let ok = true;
      let contact = 0;
      for (const [cx, cy] of variant.cells) {
        const ax = x + cx;
        const ay = y + cy;
        if (ax < MARGIN || ay < MARGIN || ax >= GRID_WIDTH - MARGIN || ay >= GRID_HEIGHT - MARGIN) {
          ok = false;
          break;
        }
        const i = ay * GRID_WIDTH + ax;
        if (acc[i]) {
          ok = false;
          break;
        }
        if (acc[i - 1] || acc[i + 1] || acc[i - GRID_WIDTH] || acc[i + GRID_WIDTH]) contact++;
      }
      if (ok && contact >= MIN_CONTACT) out.push({ x, y, contact });
    }
  }
  return out;
}

function paint(acc: Uint8Array, p: Placed): void {
  for (const [cx, cy] of p.variant.cells) acc[(p.y + cy) * GRID_WIDTH + p.x + cx] = 1;
}

/** Có ô trống nào bị bao kín trong bóng (lỗ thủng hoặc khe hở) không. */
function hasHole(acc: Uint8Array): boolean {
  const seen = new Uint8Array(acc.length);
  const stack: number[] = [0];
  seen[0] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % GRID_WIDTH;
    const y = (i - x) / GRID_WIDTH;
    const next = [
      x > 0 ? i - 1 : -1,
      x < GRID_WIDTH - 1 ? i + 1 : -1,
      y > 0 ? i - GRID_WIDTH : -1,
      y < GRID_HEIGHT - 1 ? i + GRID_WIDTH : -1,
    ];
    for (const n of next) {
      if (n >= 0 && !seen[n] && !acc[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  for (let i = 0; i < acc.length; i++) if (!acc[i] && !seen[i]) return true;
  return false;
}

/** Bước 1: ghép `count` mảnh sát cạnh. Trả null nếu kẹt. */
export function assemble(count: number, rng: Rng): Placed[] | null {
  const acc = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  const placed: Placed[] = [];

  const first = pickWeighted(
    PALETTE.filter((v) => v.size >= 32),
    (v) => v.weight,
    rng
  );
  const root: Placed = {
    variant: first,
    x: Math.round((64 - first.size / 2) / STEP) * STEP,
    y: Math.round((80 - first.size / 2) / STEP) * STEP,
  };
  placed.push(root);
  paint(acc, root);

  while (placed.length < count) {
    const bounds = {
      x0: Math.min(...placed.map((p) => p.x)),
      y0: Math.min(...placed.map((p) => p.y)),
      x1: Math.max(...placed.map((p) => p.x + p.variant.size)),
      y1: Math.max(...placed.map((p) => p.y + p.variant.size)),
    };
    let chosen: Placed | null = null;
    for (let attempt = 0; attempt < 12 && !chosen; attempt++) {
      const variant = pickWeighted(PALETTE, (v) => v.weight, rng);
      const cands = candidatesFor(variant, acc, bounds);
      if (cands.length === 0) continue;
      const c = pickWeighted(cands, (k) => k.contact, rng);
      chosen = { variant, x: c.x, y: c.y };
    }
    if (!chosen) return null;
    placed.push(chosen);
    paint(acc, chosen);
  }
  if (hasHole(acc)) return null;
  return placed;
}


/** Biến thể có thể đứng trên trục giữa (tự đối xứng qua x = 64). */
function axisVariants(): Variant[] {
  return PALETTE.filter(
    (v) =>
      (v.kind === 'square' || v.kind === 'diamond' || (v.kind === 'triangle' && (v.orientation === 4 || v.orientation === 6))) &&
      v.size % 16 === 0
  );
}

function mirrorVariant(v: Variant): Variant | undefined {
  const o = mirrorOrientation(v.kind, v.orientation, 'x');
  return PALETTE.find((p) => p.kind === v.kind && p.orientation === o && p.size === v.size);
}

/** Cặp gương: mảnh bên phải trục và bản đối xứng của nó (x' = 128 - x - khung). */
function mirrorOf(p: Placed): Placed | null {
  const variant = mirrorVariant(p.variant);
  return variant ? { variant, x: 128 - p.x - p.variant.size, y: p.y } : null;
}

function overlaps(acc: Uint8Array, p: Placed): boolean {
  for (const [cx, cy] of p.variant.cells) if (acc[(p.y + cy) * GRID_WIDTH + p.x + cx]) return true;
  return false;
}

/**
 * Ghép đối xứng gương qua trục x = 64: 1–2 mảnh nằm trên trục, còn lại đi theo cặp.
 * Tổng 4 (2 trục + 1 cặp), 5 (1 trục + 2 cặp) hoặc 6 (2 trục + 2 cặp) mảnh.
 */
export function assembleSymmetric(count: number, rng: Rng): Placed[] | null {
  const axisCount = count === 5 ? 1 : 2;
  const pairCount = (count - axisCount) / 2;
  const acc = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  const placed: Placed[] = [];
  const axis = axisVariants();

  const yBounds = () => ({
    y0: placed.length ? Math.min(...placed.map((p) => p.y)) : 80,
    y1: placed.length ? Math.max(...placed.map((p) => p.y + p.variant.size)) : 80,
  });

  for (let i = 0; i < axisCount; i++) {
    let chosen: Placed | null = null;
    for (let attempt = 0; attempt < 12 && !chosen; attempt++) {
      const variant = pickWeighted(i === 0 ? axis.filter((v) => v.size >= 32) : axis, (v) => v.weight, rng);
      const x = 64 - variant.size / 2;
      if (i === 0) {
        const y = Math.round((80 - variant.size / 2) / STEP) * STEP;
        chosen = { variant, x, y };
      } else {
        const b = yBounds();
        const cands = candidatesFor(variant, acc, { x0: x, y0: b.y0, x1: x, y1: b.y1 }).filter((c) => c.x === x);
        if (cands.length) {
          const c = pickWeighted(cands, (k) => k.contact, rng);
          chosen = { variant, x, y: c.y };
        }
      }
    }
    if (!chosen) return null;
    placed.push(chosen);
    paint(acc, chosen);
  }

  for (let i = 0; i < pairCount; i++) {
    let chosen: [Placed, Placed] | null = null;
    for (let attempt = 0; attempt < 20 && !chosen; attempt++) {
      const variant = pickWeighted(PALETTE, (v) => v.weight, rng);
      const bounds = {
        x0: 64,
        y0: Math.min(...placed.map((p) => p.y)),
        x1: Math.max(...placed.map((p) => p.x + p.variant.size)),
        y1: Math.max(...placed.map((p) => p.y + p.variant.size)),
      };
      const cands = candidatesFor(variant, acc, bounds).filter((c) => c.x >= 64);
      if (!cands.length) continue;
      const c = pickWeighted(cands, (k) => k.contact, rng);
      const right: Placed = { variant, x: c.x, y: c.y };
      const left = mirrorOf(right);
      if (!left || overlaps(acc, left)) continue;
      chosen = [right, left];
    }
    if (!chosen) return null;
    for (const p of chosen) {
      placed.push(p);
      paint(acc, p);
    }
  }
  if (hasHole(acc)) return null;
  return placed;
}

/** Bóng phải gọn: lấp đầy hộp bao vừa phải và không quá dẹt. */
function looksTidy(placed: Placed[]): boolean {
  const x0 = Math.min(...placed.map((p) => p.x));
  const y0 = Math.min(...placed.map((p) => p.y));
  const x1 = Math.max(...placed.map((p) => p.x + p.variant.size));
  const y1 = Math.max(...placed.map((p) => p.y + p.variant.size));
  const area = placed.reduce((s, p) => s + p.variant.cells.length, 0);
  const fill = area / ((x1 - x0) * (y1 - y0));
  const aspect = (x1 - x0) / (y1 - y0);
  return fill >= 0.5 && fill <= 0.9 && aspect >= 0.6 && aspect <= 1.6;
}

function pieceId(variant: Variant, counters: Map<string, number>): string {
  const letter =
    variant.kind === 'square' ? 'S' : variant.kind === 'triangle' ? (variant.orientation < 4 ? 'T' : 'R') : variant.kind === 'parallelogram' ? 'P' : 'D';
  const n = (counters.get(letter) ?? 0) + 1;
  counters.set(letter, n);
  return `${letter}${n}`;
}

const DECOY_NAMES = ['B', 'C', 'D', 'E'] as const;
const MAX_DECOYS = 3;
const MIN_DECOYS = 2;
const OFFSETS: Array<readonly [number, number]> = [];
for (const dx of [-16, -8, 0, 8, 16]) {
  for (const dy of [-16, -8, 0, 8, 16]) {
    if (dx !== 0 || dy !== 0) OFFSETS.push([dx, dy]);
  }
}

export type GeneratedStats = {
  pieces: number;
  decoys: number;
  minDecoysPerPiece: number;
  diagonalPieces: number;
};

export type Generated = {
  source: LevelSource;
  result: Extract<AuthorResult, { ok: true }>;
  stats: GeneratedStats;
  /** Hash silhouette đã chuẩn hoá (gương X tính là trùng). */
  silhouetteKey: string;
};

function sourceOf(
  id: string,
  order: number,
  pieces: PieceSource[],
  placedAnchors: Array<{ pieceId: string }>
): LevelSource {
  return {
    id,
    title: `Endless ${order}`,
    chapter: 1,
    order,
    contentRevision: 'endless-lab-v1',
    rotationEnabled: false,
    pieces,
    sampleSolutions: [placedAnchors.map((p) => ({ pieceId: p.pieceId, anchorId: 'A', turns: 0 as const }))],
    learningObjective: 'Thử nghiệm màn sinh tự động Chương 1',
    difficultyEstimate: 1,
    distractors: [],
    ftueSteps: [],
  };
}

function silhouetteKeyOf(doc: { targetCells: ReadonlyArray<readonly [number, number]> }): string {
  const xs = doc.targetCells.map((c) => c[0]);
  const ys = doc.targetCells.map((c) => c[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const hash = (flip: boolean): string => {
    const set = doc.targetCells
      .map(([x, y]) => (flip ? x1 - x : x - x0) * 1000 + (y - y0))
      .sort((a, b) => a - b);
    let h = 2166136261;
    for (const v of set) h = Math.imul(h ^ v, 16777619) >>> 0;
    return `${set.length}:${h.toString(16)}`;
  };
  const a = hash(false);
  const b = hash(true);
  return a < b ? a : b;
}

/** Sinh một màn từ seed; trả null nếu ứng viên này không đạt. */
export type Mode = 'sym' | 'free';

export function generateLevel(seed: number, id: string, order: number, mode: Mode = 'sym'): Generated | null {
  const rng = mulberry32(seed);
  const count = 4 + Math.floor(rng() * 3);
  const placed = mode === 'sym' ? assembleSymmetric(count, rng) : assemble(count, rng);
  if (!placed || !looksTidy(placed)) return null;
  return generateFromPlaced(placed, rng, id, order);
}

/** Dựng lại một cách phủ (chỉ số biến thể + vị trí) thành danh sách mảnh. */
export function placedFromTiling(tiling: ReadonlyArray<{ variant: number; x: number; y: number }>): Placed[] {
  return tiling.map((t) => ({ variant: PALETTE[t.variant], x: t.x, y: t.y }));
}

/** Cổng đa dạng: từ 3 loại hình trở lên và không quá 3 mảnh giống hệt nhau. */
export function diverseEnough(placed: readonly Placed[]): boolean {
  const types = new Set(placed.map((p) => p.variant.kind + (p.variant.kind === 'triangle' && p.variant.orientation >= 4 ? 'R' : '')));
  const exact = new Map<string, number>();
  for (const p of placed) {
    const k = p.variant.kind + p.variant.orientation + p.variant.size;
    exact.set(k, (exact.get(k) ?? 0) + 1);
  }
  return types.size >= 3 && Math.max(...exact.values()) <= 3;
}

/** Điểm đa dạng: nhiều loại hình và nhiều cỡ khung thì cao. */
export function diversityOf(placed: readonly Placed[]): number {
  const types = new Set(placed.map((p) => p.variant.kind + (p.variant.kind === 'triangle' && p.variant.orientation >= 4 ? 'R' : '')));
  const sizes = new Set(placed.map((p) => p.variant.size));
  const exact = new Set(placed.map((p) => p.variant.kind + p.variant.orientation + p.variant.size));
  return types.size * 3 + sizes.size * 2 + exact.size;
}

/** Thêm neo nhiễu, giải và chốt cổng cho một bộ mảnh đã ghép sẵn. */
export function generateFromPlaced(placed: Placed[], rng: Rng, id: string, order: number): Generated | null {
  if (!diverseEnough(placed)) return null;
  const counters = new Map<string, number>();
  const pieces: PieceSource[] = placed.map((p) => ({
    id: pieceId(p.variant, counters),
    shapeKind: p.variant.kind,
    orientation: p.variant.orientation,
    frameSize: p.variant.size,
    anchors: [{ id: 'A', x: p.x, y: p.y }],
  }));
  const solution = pieces.map((p) => ({ pieceId: p.id }));

  // Mask bóng đích để xếp hạng neo nhiễu "vừa khít giả"
  const target = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  for (const p of placed) paint(target, p);

  // Bước 2: thêm neo nhiễu, giữ neo nào vẫn còn đúng 1 nghiệm
  const base = sourceOf(id, order, pieces, solution);
  const baseDoc = buildLevelDocument(base);
  const baseSolved = solveLevel(baseDoc);
  if (!baseSolved.proven || baseSolved.solutionCount !== 1 || baseSolved.fewerPieceSolutions !== 0) return null;

  const decoyCount = new Map<string, number>();
  const order2 = pieces.map((_, i) => i).sort(() => rng() - 0.5);
  for (const pi of order2) {
    const piece = pieces[pi];
    const p = placed[pi];
    const ranked = OFFSETS.map(([dx, dy]) => {
      const x = p.x + dx;
      const y = p.y + dy;
      let inside = 0;
      for (const [cx, cy] of p.variant.cells) {
        const ax = x + cx;
        const ay = y + cy;
        if (ax >= 0 && ay >= 0 && ax < GRID_WIDTH && ay < GRID_HEIGHT && target[ay * GRID_WIDTH + ax]) inside++;
      }
      // Ưu tiên neo mà mảnh vẫn nằm gần hết trong bóng, nhiễu nhẹ để đa dạng
      return { x, y, score: inside / p.variant.cells.length + rng() * 0.3 };
    })
      .filter((c) => anchorFitsBoard(piece, c, false))
      .sort((a, b) => b.score - a.score);

    let tried = 0;
    for (const cand of ranked) {
      if ((decoyCount.get(piece.id) ?? 0) >= MAX_DECOYS || tried >= 10) break;
      tried++;
      const anchorId = DECOY_NAMES[decoyCount.get(piece.id) ?? 0];
      piece.anchors.push({ id: anchorId, x: cand.x, y: cand.y });
      const doc = buildLevelDocument(base);
      const solved = solveLevel(doc);
      if (solved.proven && solved.solutionCount === 1 && solved.fewerPieceSolutions === 0) {
        decoyCount.set(piece.id, (decoyCount.get(piece.id) ?? 0) + 1);
      } else {
        piece.anchors.pop();
      }
    }
  }
  const counts = pieces.map((p) => decoyCount.get(p.id) ?? 0);
  if (Math.min(...counts) < MIN_DECOYS) return null;

  // Bước 3: cổng cuối qua đường authoring thật
  const result = authorLevel(base);
  if (!result.ok) return null;
  const r = result.report;
  if (!r.proven || r.solutionCount !== 1 || r.fewerPieceSolutions !== 0) return null;

  return {
    source: base,
    result,
    stats: {
      pieces: pieces.length,
      decoys: counts.reduce((a, b) => a + b, 0),
      minDecoysPerPiece: Math.min(...counts),
      diagonalPieces: placed.filter((p) => p.variant.kind !== 'square').length,
    },
    silhouetteKey: silhouetteKeyOf(result.doc),
  };
}
