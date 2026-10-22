import type { Level } from './model.ts';

/**
 * Xoay liên động (chương 3): `drives` ghi mảnh nào xoay theo khi một mảnh xoay.
 * Liên kết một chiều và chỉ một bước (không lan): A dẫn B, B dẫn C thì xoay A
 * kéo B xoay chứ không kéo C.
 */
export type Links = Readonly<Record<string, readonly string[]>>;

/** Các mảnh xoay một nấc khi bấm Xoay trên `pieceId`: chính nó và các mảnh nó dẫn. */
export function rotationGroup(level: Pick<Level, 'pieces'>, pieceId: string): string[] {
  const piece = level.pieces.find((p) => p.id === pieceId);
  if (!piece) return [];
  const followers = (piece.drives ?? []).filter((id) => id !== pieceId && level.pieces.some((p) => p.id === id));
  return [pieceId, ...followers];
}

/** Số tư thế khác nhau của một hình khi xoay: vuông, thoi, tròn 1; bình hành 2; tam giác 4. */
export function turnPeriod(shapeKind: string | undefined): number {
  if (shapeKind === 'square' || shapeKind === 'diamond' || shapeKind === 'circle') return 1;
  if (shapeKind === 'parallelogram') return 2;
  return 4;
}

/**
 * Số lần bấm Xoay riêng trên từng mảnh (0..3) ít nhất để đạt các nấc đích `target`.
 * Nấc cuối của mảnh i = r_i + Σ r_j với j dẫn i (mod 4); chỉ cần khớp theo chu kỳ của hình
 * (`periods`, mặc định 4): bình hành chỉ cần đúng chẵn/lẻ, hình vuông xoay thế nào cũng được.
 * Returns a plan with the fewest total presses, or null when the target is unreachable.
 */
export function pressPlan(
  ids: readonly string[],
  drives: Links,
  target: Readonly<Record<string, number>>,
  periods: Readonly<Record<string, number>> = {}
): Record<string, number> | null {
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const driversOf: number[][] = ids.map(() => []);
  for (const [driver, list] of Object.entries(drives)) {
    const d = index.get(driver);
    if (d === undefined) continue;
    for (const follower of list) {
      const f = index.get(follower);
      if (f !== undefined) driversOf[f].push(d);
    }
  }
  const total = 4 ** n;
  let best = -1;
  let bestSum = Infinity;
  const r = new Array<number>(n);
  for (let code = 0; code < total; code++) {
    let rest = code;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      r[i] = rest % 4;
      rest = Math.floor(rest / 4);
      sum += r[i];
    }
    if (sum >= bestSum) continue;
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const period = periods[ids[i]] ?? 4;
      const final = r[i] + driversOf[i].reduce((acc, d) => acc + r[d], 0);
      ok = (((final - (target[ids[i]] ?? 0)) % period) + period) % period === 0;
    }
    if (ok) {
      best = code;
      bestSum = sum;
    }
  }
  if (best < 0) return null;
  const plan: Record<string, number> = {};
  let rest = best;
  for (const id of ids) {
    plan[id] = rest % 4;
    rest = Math.floor(rest / 4);
  }
  return plan;
}

/** Vai của mảnh trong liên kết: dẫn, bị dẫn, cả hai, hoặc không có (để vẽ dấu liên động). */
export function linkRole(level: Pick<Level, 'pieces'>, pieceId: string): 'driver' | 'driven' | 'both' | null {
  const piece = level.pieces.find((p) => p.id === pieceId);
  if (!piece) return null;
  const drives = (piece.drives ?? []).length > 0;
  const driven = level.pieces.some((p) => p.id !== pieceId && (p.drives ?? []).includes(pieceId));
  if (drives && driven) return 'both';
  if (drives) return 'driver';
  return driven ? 'driven' : null;
}

/** Dấu của `pieceId` sáng lên khi mảnh đang chọn là chính nó (và có liên kết) hoặc là mảnh dẫn nó. */
export function linkRelated(level: Pick<Level, 'pieces'>, selectedId: string | null, pieceId: string): boolean {
  if (!selectedId) return false;
  const selected = level.pieces.find((p) => p.id === selectedId);
  if (!selected) return false;
  if (selectedId === pieceId) return linkRole(level, pieceId) !== null;
  return (selected.drives ?? []).includes(pieceId);
}
