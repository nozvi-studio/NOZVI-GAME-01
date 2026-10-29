import type { Level, Piece, PuzzleState, Transition, Turns } from '../../domain/model.ts';
import { placementsOf } from '../../domain/session.ts';
import { effectiveOrientation, shapePolygon } from '../../domain/shapes.ts';
import { isOnTarget } from '../../domain/targetMatch.ts';
import type { Pt } from '../board/polygonClip.ts';
import { diffLayers, overlapLayers } from './parityDiff.ts';

export type FeedbackEvent =
  | { type: 'lift'; pieceId: string }
  /**
   * `anchorId` là null ở màn đặt tự do (mảnh hít vào giao điểm lưới, không có neo).
   * `onTarget`: mảnh nằm đúng chỗ lời giải mẫu. Hít vào lưới thôi chưa đủ: ở màn đặt tự do thả đâu cũng hít.
   */
  | { type: 'snap'; pieceId: string; anchorId: string | null; onTarget: boolean; x: number; y: number }
  | { type: 'settle-temporary'; pieceId: string }
  | { type: 'return'; pieceId: string }
  | { type: 'rotate'; pieceId: string; turns: Turns }
  | { type: 'rotate-blocked'; pieceId: string }
  /** Vùng chẵn mới xuất hiện (toạ độ lưới) */
  | { type: 'overlap-hollow'; layers: Pt[][] }
  /** Vùng lẻ ≥ 3 lớp mới xuất hiện (toạ độ lưới) */
  | { type: 'overlap-revive'; layers: Pt[][] }
  | { type: 'reset' }
  | { type: 'won' };

/** Lệnh người chơi vừa làm; cần vì lệnh bị từ chối không mang id mảnh */
export type FeedbackSubject = { command: 'move' | 'rotate' | 'reset'; pieceId: string | null };

export function gridPolygon(piece: Piece, x: number, y: number, turns: number): Pt[] {
  const kind = piece.shapeKind ?? 'diamond';
  const orientation = effectiveOrientation(kind, piece.orientation ?? 0, turns);
  return shapePolygon(kind, orientation, piece.frameSize).map((v) => ({ x: x + v.x, y: y + v.y }));
}

export function snappedPolygons(level: Level, state: PuzzleState, excludeId?: string): Pt[][] {
  return level.pieces.flatMap((piece) => {
    const s = state.pieces[piece.id];
    if (!s || s.kind !== 'snapped' || piece.id === excludeId) return [];
    const anchor = piece.anchors.find((a) => a.id === s.anchorId);
    return anchor ? [gridPolygon(piece, anchor.x, anchor.y, s.turns)] : [];
  });
}

export function feedbackEvents(
  prev: PuzzleState,
  transition: Transition,
  level: Level,
  subject: FeedbackSubject
): FeedbackEvent[] {
  if (subject.command === 'reset') return transition.accepted ? [{ type: 'reset' }] : [];
  const pieceId = subject.pieceId;
  if (!pieceId) return [];
  if (!transition.accepted) {
    return subject.command === 'rotate' && transition.outcome === 'out-of-bounds'
      ? [{ type: 'rotate-blocked', pieceId }]
      : [];
  }

  const next = transition.state.pieces[pieceId];
  if (!next) return [];
  const events: FeedbackEvent[] = [];
  if (subject.command === 'rotate') {
    events.push({ type: 'rotate', pieceId, turns: next.turns });
    // Xoay liên động: mảnh bị dẫn cũng quay, mỗi mảnh một sự kiện để cùng xoay trên màn hình
    for (const [id, state] of Object.entries(transition.state.pieces)) {
      if (id !== pieceId && prev.pieces[id] && prev.pieces[id].turns !== state.turns) {
        events.push({ type: 'rotate', pieceId: id, turns: state.turns });
      }
    }
  } else if (next.kind === 'snapped' || next.kind === 'placed') {
    const placement = placementsOf(level, transition.state).find((p) => p.pieceId === pieceId);
    const onTarget = placement !== undefined && isOnTarget(level, placement);
    events.push({
      type: 'snap',
      pieceId,
      anchorId: next.kind === 'snapped' ? next.anchorId : null,
      onTarget,
      x: placement?.x ?? 0,
      y: placement?.y ?? 0,
    });
  }
  else if (next.kind === 'temporary') events.push({ type: 'settle-temporary', pieceId });
  else events.push({ type: 'return', pieceId });

  const { added } = diffLayers(
    overlapLayers(snappedPolygons(level, prev)),
    overlapLayers(snappedPolygons(level, transition.state))
  );
  const hollow = added.filter((l) => !l.filled).map((l) => l.points.map((p) => ({ x: p.x, y: p.y })));
  const revive = added.filter((l) => l.filled).map((l) => l.points.map((p) => ({ x: p.x, y: p.y })));
  if (hollow.length > 0) events.push({ type: 'overlap-hollow', layers: hollow });
  if (revive.length > 0) events.push({ type: 'overlap-revive', layers: revive });

  if (transition.becameWon) events.push({ type: 'won' });
  return events;
}
