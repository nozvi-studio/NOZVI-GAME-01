import type { Cell, Turns } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../domain/model.ts';
import { turnedCells } from '../domain/geometry.ts';
import { GRID_STEP } from '../domain/freePlacement.ts';
import { effectiveOrientation } from '../domain/shapes.ts';
import type { LevelDocument } from './document.ts';

/** Trần tích số lựa chọn của nửa lớn; vượt thì không duyệt (FP-09). */
export const SOLVER_LIMIT = 5_000_000;

/** Seed cố định để mã băm ô giống nhau giữa mọi lần chạy (FP-07). */
const HASH_SEED = 0x5eed;

/** Quá số mảnh này thì việc thử mọi cách chia đôi (2^n) không còn rẻ. */
const MAX_PIECES = 20;

export type SolverOptions = { limit?: number };

export type SolverResult = {
  solutionCount: number;
  fewerPieceSolutions: number;
  proven: boolean;
  /** Số tư thế trên bàn của từng mảnh, không tính lựa chọn "ở khay" */
  poseCounts: number[];
  elapsedMs: number;
};

/** Một tư thế đặt mảnh; `cells` là chỉ số ô tuyệt đối y * width + x trên bàn đang giải. */
export type SolverPose = Readonly<{ x: number; y: number; turns: Turns; cells: Int32Array }>;

export type PoseSpace = Readonly<{
  width: number;
  height: number;
  pieces: ReadonlyArray<Readonly<{ id: string; group: string; poses: readonly SolverPose[] }>>;
  target: Int32Array;
}>;

type DocPiece = LevelDocument['pieces'][number];

/**
 * Nấc xoay đại diện: mỗi hướng hiệu dụng khác nhau lấy nấc nhỏ nhất (FP-06).
 * Vuông, thoi, tròn 1; bình hành 2; tam giác 4. Không xoay thì chỉ nấc 0.
 */
export function representativeTurns(piece: DocPiece, rotationEnabled: boolean): Turns[] {
  if (!rotationEnabled) return [0];
  const seen = new Set<number>();
  const result: Turns[] = [];
  for (const turns of [0, 1, 2, 3] as const) {
    const orientation = effectiveOrientation(piece.shapeKind, piece.orientation ?? 0, turns);
    if (seen.has(orientation)) continue;
    seen.add(orientation);
    result.push(turns);
  }
  return result;
}

/** Cùng ngữ nghĩa với fitsBoard nhưng trên bàn kích thước tuỳ ý (để kiểm chéo bàn thu nhỏ). */
function fitsRegion(
  cells: readonly Cell[],
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  for (const [cx, cy] of cells) {
    const px = x + cx;
    const py = y + cy;
    if (px < 0 || px >= width || py < 0 || py >= height) return false;
  }
  return true;
}

/**
 * Liệt kê tư thế của mọi mảnh (FP-06). Màn neo: các neo của mảnh. Màn free:
 * mọi gốc là bội của 8 mà mảnh vừa bàn. Mỗi gốc nhân với các nấc xoay đại
 * diện. Lựa chọn "ở khay" không nằm trong danh sách; bộ giải tự thêm.
 */
export function buildPoseSpace(
  doc: LevelDocument,
  board: { width: number; height: number } = { width: GRID_WIDTH, height: GRID_HEIGHT }
): PoseSpace {
  const { width, height } = board;
  const free = doc.placement === 'free';

  const pieces = doc.pieces.map((piece) => {
    const origins: Array<{ x: number; y: number }> = [];
    if (free) {
      for (let y = 0; y < height; y += GRID_STEP) {
        for (let x = 0; x < width; x += GRID_STEP) origins.push({ x, y });
      }
    } else {
      for (const anchor of piece.anchors) origins.push({ x: anchor.x, y: anchor.y });
    }

    const poses: SolverPose[] = [];
    for (const turns of representativeTurns(piece, doc.rotationEnabled)) {
      const cells = turnedCells(piece, turns);
      for (const { x, y } of origins) {
        if (!fitsRegion(cells, x, y, width, height)) continue;
        poses.push({
          x,
          y,
          turns,
          cells: Int32Array.from(cells, ([cx, cy]) => (y + cy) * width + x + cx),
        });
      }
    }
    return {
      id: piece.id,
      // Hai mảnh cùng hình, hướng, khung là "giống hệt": đổi chỗ không sinh nghiệm mới
      group: `${piece.shapeKind}:${piece.orientation ?? 0}:${piece.frameSize}`,
      poses,
    };
  });

  const target = Int32Array.from(doc.targetCells, ([x, y]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      throw new Error(`solver:target-outside-board:${doc.id}`);
    }
    return y * width + x;
  });

  return { width, height, pieces, target };
}

/**
 * Chia mảnh thành hai nửa sao cho tích số lựa chọn của nửa lớn nhỏ nhất
 * (FP-08). `table` là nửa có tích nhỏ hơn (dựng bảng băm), `scan` là nửa còn
 * lại (duyệt và tra bảng). Hoà thì giữ cách chia gặp trước.
 */
export function balancedSplit(
  optionCounts: readonly number[]
): { table: number[]; scan: number[]; maxProduct: number } {
  const n = optionCounts.length;
  if (n > MAX_PIECES) throw new Error(`solver:too-many-pieces:${n}`);

  let bestMask = 0;
  let bestMax = Infinity;
  for (let mask = 0; mask < 1 << n; mask++) {
    let inside = 1;
    let outside = 1;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) inside *= optionCounts[i];
      else outside *= optionCounts[i];
    }
    const max = Math.max(inside, outside);
    if (max < bestMax) {
      bestMax = max;
      bestMask = mask;
    }
  }

  const inside: number[] = [];
  const outside: number[] = [];
  let insideProduct = 1;
  let outsideProduct = 1;
  for (let i = 0; i < n; i++) {
    if (bestMask & (1 << i)) {
      inside.push(i);
      insideProduct *= optionCounts[i];
    } else {
      outside.push(i);
      outsideProduct *= optionCounts[i];
    }
  }
  return insideProduct <= outsideProduct
    ? { table: inside, scan: outside, maxProduct: bestMax }
    : { table: outside, scan: inside, maxProduct: bestMax };
}

/** PRNG mulberry32: đủ đều cho mã băm, xác định theo seed. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * Duyệt mọi tổ hợp lựa chọn của nhóm mảnh `group` theo kiểu đồng hồ đo:
 * chữ số đầu đổi nhanh nhất, nên chỉ số tổ hợp = d0 + r0 * (d1 + r1 * (…)).
 * Mã băm được cập nhật tăng dần bằng XOR (bỏ lựa chọn cũ, thêm lựa chọn mới).
 */
function forEachCombo(
  group: readonly number[],
  optHi: readonly Uint32Array[],
  optLo: readonly Uint32Array[],
  visit: (index: number, hi: number, lo: number, digits: Int32Array) => void
): void {
  const digits = new Int32Array(group.length);
  let hi = 0;
  let lo = 0;
  let index = 0;
  for (;;) {
    visit(index, hi >>> 0, lo >>> 0, digits);
    index++;
    let k = 0;
    for (; k < group.length; k++) {
      const piece = group[k];
      const current = digits[k];
      const next = current + 1 === optHi[piece].length ? 0 : current + 1;
      hi ^= optHi[piece][current] ^ optHi[piece][next];
      lo ^= optLo[piece][current] ^ optLo[piece][next];
      digits[k] = next;
      if (next !== 0) break;
    }
    if (k === group.length) return;
  }
}

/** Kiểm lại bằng mask thật: loại mọi trùng băm giả (FP-08 bước 4). */
function matchesExactly(
  space: PoseSpace,
  choice: Int32Array,
  scratch: Uint8Array,
  targetMask: Uint8Array
): boolean {
  const apply = (): void => {
    space.pieces.forEach((piece, p) => {
      const option = choice[p];
      if (option === 0) return;
      for (const c of piece.poses[option - 1].cells) scratch[c] ^= 1;
    });
  };
  apply();
  let same = true;
  for (let i = 0; i < scratch.length; i++) {
    if (scratch[i] !== targetMask[i]) {
      same = false;
      break;
    }
  }
  apply(); // XOR lần nữa để trả scratch về toàn 0
  return same;
}

/** Khoá chuẩn của một nghiệm: trong mỗi nhóm mảnh giống hệt, tư thế được sắp xếp. */
function canonicalKey(space: PoseSpace, choice: Int32Array): string {
  const groups = new Map<string, string[]>();
  space.pieces.forEach((piece, p) => {
    const option = choice[p];
    const pose = option === 0 ? null : piece.poses[option - 1];
    const label = pose === null ? 'khay' : `${pose.x},${pose.y},${pose.turns}`;
    const list = groups.get(piece.group);
    if (list) list.push(label);
    else groups.set(piece.group, [label]);
  });
  return [...groups.keys()]
    .sort()
    .map((g) => `${g}=${groups.get(g)!.sort().join('|')}`)
    .join('/');
}

/**
 * Đếm nghiệm phân biệt bằng gặp-nhau-ở-giữa trên mã băm XOR 64 bit (FP-07, FP-08).
 * Lựa chọn 0 của mỗi mảnh là "ở khay" (mã băm 0), lựa chọn k là tư thế k − 1.
 */
export function solvePoseSpace(space: PoseSpace, options: SolverOptions = {}): SolverResult {
  const started = performance.now();
  const limit = options.limit ?? SOLVER_LIMIT;
  const pieces = space.pieces;
  const n = pieces.length;
  const poseCounts = pieces.map((piece) => piece.poses.length);
  const cellCount = space.width * space.height;

  // Mã băm 64 bit mỗi ô, lưu thành hai số 32 bit
  const random = mulberry32(HASH_SEED);
  const cellHi = new Uint32Array(cellCount);
  const cellLo = new Uint32Array(cellCount);
  for (let i = 0; i < cellCount; i++) {
    cellHi[i] = random();
    cellLo[i] = random();
  }

  const optHi: Uint32Array[] = [];
  const optLo: Uint32Array[] = [];
  for (const piece of pieces) {
    const hiList = new Uint32Array(piece.poses.length + 1);
    const loList = new Uint32Array(piece.poses.length + 1);
    piece.poses.forEach((pose, k) => {
      let hi = 0;
      let lo = 0;
      for (const c of pose.cells) {
        hi ^= cellHi[c];
        lo ^= cellLo[c];
      }
      hiList[k + 1] = hi >>> 0;
      loList[k + 1] = lo >>> 0;
    });
    optHi.push(hiList);
    optLo.push(loList);
  }

  let targetHi = 0;
  let targetLo = 0;
  for (const c of space.target) {
    targetHi ^= cellHi[c];
    targetLo ^= cellLo[c];
  }
  targetHi >>>= 0;
  targetLo >>>= 0;

  const split = balancedSplit(pieces.map((piece) => piece.poses.length + 1));
  if (split.maxProduct > limit) {
    return {
      solutionCount: 0,
      fewerPieceSolutions: 0,
      proven: false,
      poseCounts,
      elapsedMs: performance.now() - started,
    };
  }

  // Bảng băm của nửa nhỏ: mảng định kiểu, xích theo bit thấp của nửa sau mã băm
  const tableSize = split.table.reduce((product, p) => product * optHi[p].length, 1);
  let bits = 1;
  while (1 << bits < tableSize * 2) bits++;
  const bucketMask = (1 << bits) - 1;
  const heads = new Int32Array(1 << bits).fill(-1);
  const chain = new Int32Array(tableSize);
  const keyHi = new Uint32Array(tableSize);
  const keyLo = new Uint32Array(tableSize);
  forEachCombo(split.table, optHi, optLo, (index, hi, lo) => {
    keyHi[index] = hi;
    keyLo[index] = lo;
    const bucket = lo & bucketMask;
    chain[index] = heads[bucket];
    heads[bucket] = index;
  });

  const targetMask = new Uint8Array(cellCount);
  for (const c of space.target) targetMask[c] = 1;
  const scratch = new Uint8Array(cellCount);
  const choice = new Int32Array(n);
  const solutions = new Set<string>();
  const fewer = new Set<string>();

  forEachCombo(split.scan, optHi, optLo, (_, hi, lo, digits) => {
    const needHi = (targetHi ^ hi) >>> 0;
    const needLo = (targetLo ^ lo) >>> 0;
    for (let entry = heads[needLo & bucketMask]; entry !== -1; entry = chain[entry]) {
      if (keyHi[entry] !== needHi || keyLo[entry] !== needLo) continue;
      let rest = entry;
      for (const p of split.table) {
        const radix = optHi[p].length;
        choice[p] = rest % radix;
        rest = Math.floor(rest / radix);
      }
      split.scan.forEach((p, k) => {
        choice[p] = digits[k];
      });
      if (!matchesExactly(space, choice, scratch, targetMask)) continue;
      const key = canonicalKey(space, choice);
      solutions.add(key);
      if (choice.some((option) => option === 0)) fewer.add(key);
    }
  });

  return {
    solutionCount: solutions.size,
    fewerPieceSolutions: fewer.size,
    proven: true,
    poseCounts,
    elapsedMs: performance.now() - started,
  };
}

/** Trần số nút của bộ giải phủ chính xác; vượt thì kết quả chưa được chứng minh. */
export const EXACT_COVER_NODE_LIMIT = 20_000_000;

/**
 * Đếm nghiệm của màn "chỉ xếp hình" (chương 1 và 3: nghiệm không xếp chồng, không XOR):
 * mỗi nghiệm là một cách lát kín bóng mục tiêu bằng các tư thế nằm hẳn trong bóng và
 * không đè nhau. Duyệt ô mục tiêu thấp nhất chưa phủ, thử mọi tư thế của mảnh chưa dùng
 * có ô thấp nhất đúng ô đó. Nhanh hơn nhiều so với gặp-nhau-ở-giữa vì chỉ giữ tư thế
 * nằm trong bóng, nên chứng minh được cả màn đặt tự do nhiều mảnh xoay.
 * Mảnh không dùng ở lại khay (nghiệm ít mảnh hơn). Khoá nghiệm giống `solvePoseSpace`,
 * nên hai bộ giải cho cùng `solutionCount` trên mọi màn không xoay chồng.
 */
export function solveExactCover(space: PoseSpace, options: { nodeLimit?: number } = {}): SolverResult {
  const started = performance.now();
  const nodeLimit = options.nodeLimit ?? EXACT_COVER_NODE_LIMIT;
  const cellCount = space.width * space.height;
  const inTarget = new Uint8Array(cellCount);
  for (const c of space.target) inTarget[c] = 1;
  const order = Array.from(space.target).sort((x, y) => x - y);

  type Candidate = { piece: number; option: number; cells: Int32Array };
  const byMinCell = new Map<number, Candidate[]>();
  space.pieces.forEach((piece, p) => {
    piece.poses.forEach((pose, k) => {
      let min = Infinity;
      for (const c of pose.cells) {
        if (!inTarget[c]) return;
        if (c < min) min = c;
      }
      const list = byMinCell.get(min);
      const candidate = { piece: p, option: k + 1, cells: pose.cells };
      if (list) list.push(candidate);
      else byMinCell.set(min, [candidate]);
    });
  });

  const covered = new Uint8Array(cellCount);
  const used = new Uint8Array(space.pieces.length);
  const choice = new Int32Array(space.pieces.length);
  const solutions = new Set<string>();
  const fewer = new Set<string>();
  let nodes = 0;
  let exhausted = false;

  const dfs = (from: number): void => {
    if (exhausted) return;
    let i = from;
    while (i < order.length && covered[order[i]]) i++;
    if (i === order.length) {
      const key = canonicalKey(space, choice);
      solutions.add(key);
      if (choice.some((option) => option === 0)) fewer.add(key);
      return;
    }
    const cell = order[i];
    for (const candidate of byMinCell.get(cell) ?? []) {
      if (used[candidate.piece]) continue;
      if (++nodes > nodeLimit) {
        exhausted = true;
        return;
      }
      if (candidate.cells.some((c) => covered[c])) continue;
      for (const c of candidate.cells) covered[c] = 1;
      used[candidate.piece] = 1;
      choice[candidate.piece] = candidate.option;
      dfs(i + 1);
      choice[candidate.piece] = 0;
      used[candidate.piece] = 0;
      for (const c of candidate.cells) covered[c] = 0;
    }
  };
  dfs(0);

  return {
    solutionCount: solutions.size,
    fewerPieceSolutions: fewer.size,
    proven: !exhausted,
    poseCounts: space.pieces.map((piece) => piece.poses.length),
    elapsedMs: performance.now() - started,
  };
}

/**
 * Giải một màn trên bàn 128 × 160 (màn neo hoặc màn free). Màn chương "chỉ xếp hình"
 * (`tilingOnly`) mà gặp-nhau-ở-giữa vượt trần thì chuyển sang bộ giải phủ chính xác.
 */
export function solveLevel(doc: LevelDocument, options: SolverOptions & { tilingOnly?: boolean } = {}): SolverResult {
  const space = buildPoseSpace(doc);
  const general = solvePoseSpace(space, options);
  if (general.proven || !options.tilingOnly) return general;
  return solveExactCover(space);
}
