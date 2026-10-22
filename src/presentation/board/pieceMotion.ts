import type { Piece, PieceState } from '../../domain/model.ts';
import { FEEDBACK_TOKENS, PIECE_TOKENS } from '../designTokens.ts';
import type { LayoutMetrics } from './layout.ts';
import { pieceCenterCanvas, pieceHitbox, pieceRadiusPx, trayPieceRadiusPx } from './layout.ts';
import { EASES } from '../transitions/motion.ts';

export type Pt = { x: number; y: number };

/** Tư thế hiển thị của một mảnh; tách khỏi trạng thái logic để nội suy được */
export type Pose = { x: number; y: number; scale: number; angle: number; alpha: number };

export type PoseTau = { position: number; scale: number; angle: number; alpha: number };

const T = FEEDBACK_TOKENS.tau;

export const POSE_TAU: Record<'dragging' | 'settling' | 'idle', PoseTau> = {
  dragging: { position: T.follow, scale: T.scale, angle: T.tilt, alpha: T.selectAlpha },
  settling: { position: T.settle, scale: T.scale, angle: T.tilt, alpha: T.selectAlpha },
  idle: { position: T.idle, scale: T.scale, angle: T.tilt, alpha: T.selectAlpha },
};

/**
 * Làm mượt theo hàm mũ: phần còn thiếu giảm theo exp(−dt/τ). Vì exp(a)·exp(b)
 * = exp(a+b), chia một bước thành nhiều bước nhỏ cho đúng cùng kết quả, nên
 * chuyển động không phụ thuộc FPS.
 */
export function stepScalar(current: number, target: number, dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return target;
  return target + (current - target) * Math.exp(-dtMs / tauMs);
}

export function stepPose(current: Pose, target: Pose, dtMs: number, tau: PoseTau): Pose {
  return {
    x: stepScalar(current.x, target.x, dtMs, tau.position),
    y: stepScalar(current.y, target.y, dtMs, tau.position),
    scale: stepScalar(current.scale, target.scale, dtMs, tau.scale),
    angle: stepScalar(current.angle, target.angle, dtMs, tau.angle),
    alpha: stepScalar(current.alpha, target.alpha, dtMs, tau.alpha),
  };
}

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    scale: a.scale + (b.scale - a.scale) * k,
    angle: a.angle + (b.angle - a.angle) * k,
    alpha: a.alpha + (b.alpha - a.alpha) * k,
  };
}

/** Mảnh vào vùng hít bị kéo thêm `strength` phần quãng còn lại về tâm neo */
export function magnetPose(pointer: Pt, anchor: Pt, strength: number): Pt {
  return {
    x: pointer.x + (anchor.x - pointer.x) * strength,
    y: pointer.y + (anchor.y - pointer.y) * strength,
  };
}

export function tiltDeg(vxPxPerSec: number): number {
  const max = FEEDBACK_TOKENS.tiltMaxDeg;
  return Math.min(max, Math.max(-max, vxPxPerSec * FEEDBACK_TOKENS.tiltPerPxPerSec));
}

/** Nảy khi khớp: 1.08 xuống 0.98 ở 40% rồi về 1 */
export function bounceScale(t: number): number {
  const { bounceFrom, bounceDip, bounceDipAt } = FEEDBACK_TOKENS;
  if (t >= 1) return 1;
  if (t <= bounceDipAt) return bounceFrom + (bounceDip - bounceFrom) * EASES.cubicOut(t / bounceDipAt);
  return bounceDip + (1 - bounceDip) * EASES.cubicOut((t - bounceDipAt) / (1 - bounceDipAt));
}

/** Lắc ngang khi xoay bị chặn: 3 nhịp, tắt dần */
export function shakeOffset(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return FEEDBACK_TOKENS.shakePx * Math.sin(2 * Math.PI * FEEDBACK_TOKENS.shakeCycles * t) * (1 - t);
}

/** Chớp sáng: lên đỉnh ở giữa rồi tắt */
export function lightAlpha(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * t);
}

export type PoseInput = {
  layout: LayoutMetrics;
  trayIndex: number;
  trayCount: number;
  selected: boolean;
  showTarget: boolean;
  /** Chỉ có khi chính mảnh này đang được kéo; toạ độ là tâm mảnh */
  drag: { x: number; y: number; candidate: Pt | null } | null;
};

export function anchorCenter(piece: Piece, anchorId: string, layout: LayoutMetrics): Pt | null {
  const anchor = piece.anchors.find((a) => a.id === anchorId);
  return anchor ? pieceCenterCanvas(piece.frameSize, anchor.x, anchor.y, layout) : null;
}

/** Tư thế mảnh cần đạt theo trạng thái logic; PieceView đuổi theo nó mỗi khung */
export function pieceTargetPose(piece: Piece, state: PieceState, input: PoseInput): Pose {
  const { layout } = input;
  if (input.drag) {
    const { x, y, candidate } = input.drag;
    const at = candidate ? magnetPose({ x, y }, candidate, FEEDBACK_TOKENS.magnetStrength) : { x, y };
    return { x: at.x, y: at.y, scale: 1, angle: 0, alpha: candidate ? 1 : PIECE_TOKENS.ghostAlpha };
  }
  if (state.kind === 'snapped' || state.kind === 'placed') {
    // Mảnh khớp neo, hoặc (màn đặt tự do) đặt vào giao điểm lưới: cùng cỡ thật trên bàn
    const c =
      state.kind === 'placed'
        ? pieceCenterCanvas(piece.frameSize, state.x, state.y, layout)
        : anchorCenter(piece, state.anchorId, layout) ?? anchorCenter(piece, piece.anchors[0].id, layout)!;
    // With the Eye on, the figure the player built recedes so the target reads
    // over it. The dragged piece is handled above and never dims.
    return {
      x: c.x,
      y: c.y,
      scale: 1,
      angle: 0,
      alpha: input.showTarget ? FEEDBACK_TOKENS.eyeResultAlpha : 1,
    };
  }
  if (state.kind === 'temporary') {
    const c = pieceCenterCanvas(piece.frameSize, state.x, state.y, layout);
    return { x: c.x, y: c.y, scale: 1, angle: 0, alpha: input.selected ? 0.85 : 0.6 };
  }
  const hit = pieceHitbox(piece, state, layout, input.trayIndex, input.trayCount);
  return {
    x: hit.x + hit.width / 2,
    y: hit.y + hit.height / 2,
    scale: trayPieceRadiusPx(layout, input.trayCount) / pieceRadiusPx(piece.frameSize, layout),
    angle: 0,
    alpha: input.selected ? 1 : 0.9,
  };
}

/**
 * Ring drawn at the candidate anchor while a piece approaches it. A candidate
 * only exists inside the snap radius, so the ring appearing is the "in range"
 * signal and its tightening is the "how close" signal. Both ratios stay above
 * 1, so the ring never draws inside the piece itself.
 */
export function magnetRing(
  distPx: number,
  pieceRadiusPx: number
): { radius: number; alpha: number } {
  const F = FEEDBACK_TOKENS;
  const span = pieceRadiusPx * F.magnetRingSpanRatio;
  const k = span <= 0 ? 0 : Math.min(1, Math.max(0, distPx / span));
  return {
    radius: pieceRadiusPx * (F.magnetRingNearRatio + (F.magnetRingFarRatio - F.magnetRingNearRatio) * k),
    alpha: F.magnetRingAlphaNear + (F.magnetRingAlphaFar - F.magnetRingAlphaNear) * k,
  };
}
