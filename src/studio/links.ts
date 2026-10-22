import type { LevelSource, PieceSource } from '../content/authoring.ts';
import { pressPlan, turnPeriod } from '../domain/linkedRotation.ts';

export type LinkRole = 'driver' | 'driven' | 'both';
export type LinkEdge = { from: string; to: string };

export type PressSummary =
  | { kind: 'none' }
  | { kind: 'too-many' }
  | { kind: 'plan'; presses: Array<{ id: string; count: number }>; total: number }
  | { kind: 'unreachable'; culprits: string[] };

/** `pressPlan` tries 4^n press counts; chapter 3 has at most 5 pieces, so 8 is generous. */
const MAX_PIECES_FOR_PLAN = 8;

/** Every `drives` link whose two ends exist and differ, in piece order. */
export function linkEdges(pieces: readonly PieceSource[]): LinkEdge[] {
  const ids = new Set(pieces.map((p) => p.id));
  const edges: LinkEdge[] = [];
  for (const piece of pieces) {
    for (const to of piece.drives ?? []) {
      if (to !== piece.id && ids.has(to)) edges.push({ from: piece.id, to });
    }
  }
  return edges;
}

/** Role of each linked piece; pieces without any link are not in the result. */
export function linkRoles(pieces: readonly PieceSource[]): Record<string, LinkRole> {
  const drivers = new Set<string>();
  const driven = new Set<string>();
  for (const edge of linkEdges(pieces)) {
    drivers.add(edge.from);
    driven.add(edge.to);
  }
  const roles: Record<string, LinkRole> = {};
  for (const piece of pieces) {
    const isDriver = drivers.has(piece.id);
    const isDriven = driven.has(piece.id);
    if (isDriver && isDriven) roles[piece.id] = 'both';
    else if (isDriver) roles[piece.id] = 'driver';
    else if (isDriven) roles[piece.id] = 'driven';
  }
  return roles;
}

export function toggleDrive(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
}

/**
 * The game's own `pressPlan` for the sample solution's target turns. When the target is
 * unreachable, `culprits` are the pieces whose target, if relaxed, would make it reachable.
 */
export function pressSummary(source: Pick<LevelSource, 'pieces' | 'sampleSolutions'>): PressSummary {
  const edges = linkEdges(source.pieces);
  if (edges.length === 0) return { kind: 'none' };
  if (source.pieces.length > MAX_PIECES_FOR_PLAN) return { kind: 'too-many' };

  const ids = source.pieces.map((p) => p.id);
  const links: Record<string, string[]> = {};
  for (const edge of edges) (links[edge.from] ??= []).push(edge.to);
  const target: Record<string, number> = {};
  for (const step of source.sampleSolutions?.[0] ?? []) target[step.pieceId] = step.turns;
  const periods: Record<string, number> = {};
  for (const piece of source.pieces) periods[piece.id] = turnPeriod(piece.shapeKind);

  const plan = pressPlan(ids, links, target, periods);
  if (plan) {
    const presses = ids.filter((id) => plan[id] > 0).map((id) => ({ id, count: plan[id] }));
    return { kind: 'plan', presses, total: presses.reduce((sum, press) => sum + press.count, 0) };
  }
  const culprits = ids.filter((id) => pressPlan(ids, links, target, { ...periods, [id]: 1 }) !== null);
  return { kind: 'unreachable', culprits };
}
