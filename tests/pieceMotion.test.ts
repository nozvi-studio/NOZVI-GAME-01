import { describe, expect, test } from 'vitest';
import {
  POSE_TAU,
  anchorCenter,
  bounceScale,
  lightAlpha,
  magnetPose,
  magnetRing,
  pieceTargetPose,
  shakeOffset,
  stepPose,
  stepScalar,
  tiltDeg,
} from '../src/presentation/board/pieceMotion.ts';
import type { Pose, PoseInput } from '../src/presentation/board/pieceMotion.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { computeLayout, largestFrameSize, pieceCenterCanvas, pieceHitbox, pieceRadiusPx, trayPieceRadiusPx } from '../src/presentation/board/layout.ts';
import { FEEDBACK_TOKENS, PIECE_TOKENS } from '../src/presentation/designTokens.ts';

const layout = computeLayout(720, 1280);
const level = loadLevel('1-1', 'campaign');
const d1 = level.pieces[0];

describe('làm mượt theo hàm mũ', () => {
  test('không phụ thuộc FPS: hai bước 8 ms bằng một bước 16 ms', () => {
    const a: Pose = { x: 0, y: 0, scale: 1, angle: 0, alpha: 0 };
    const b: Pose = { x: 100, y: -50, scale: 2, angle: 10, alpha: 1 };
    const one = stepPose(a, b, 16, POSE_TAU.dragging);
    const two = stepPose(stepPose(a, b, 8, POSE_TAU.dragging), b, 8, POSE_TAU.dragging);
    for (const key of ['x', 'y', 'scale', 'angle', 'alpha'] as const) {
      expect(Math.abs(one[key] - two[key])).toBeLessThan(0.5);
    }
  });

  test('hội tụ về đích', () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = stepScalar(v, 10, 16, 35);
    expect(v).toBeCloseTo(10, 3);
  });

  test('tau 0 nhảy thẳng tới đích', () => {
    expect(stepScalar(3, 9, 16, 0)).toBe(9);
  });
});

describe('hút, nghiêng và đường cong một lần', () => {
  test('magnetPose dịch thêm đúng phần trăm quãng còn lại', () => {
    expect(magnetPose({ x: 0, y: 0 }, { x: 100, y: 40 }, 0)).toEqual({ x: 0, y: 0 });
    expect(magnetPose({ x: 0, y: 0 }, { x: 100, y: 40 }, 0.3)).toEqual({ x: 30, y: 12 });
    expect(magnetPose({ x: 0, y: 0 }, { x: 100, y: 40 }, 1)).toEqual({ x: 100, y: 40 });
  });

  test('tiltDeg = vx × 0.02, kẹp ±4°', () => {
    expect(tiltDeg(100)).toBeCloseTo(2, 9);
    expect(tiltDeg(10_000)).toBe(FEEDBACK_TOKENS.tiltMaxDeg);
    expect(tiltDeg(-10_000)).toBe(-FEEDBACK_TOKENS.tiltMaxDeg);
  });

  test('bounceScale 1.08 → 0.98 → 1', () => {
    expect(bounceScale(0)).toBeCloseTo(1.08, 9);
    expect(bounceScale(0.4)).toBeCloseTo(0.98, 9);
    expect(bounceScale(1)).toBe(1);
  });

  test('shakeOffset về 0 ở hai đầu, biên độ ≤ 6 px', () => {
    expect(shakeOffset(0)).toBe(0);
    expect(shakeOffset(1)).toBe(0);
    for (let t = 0; t <= 1; t += 0.01) expect(Math.abs(shakeOffset(t))).toBeLessThanOrEqual(6);
  });

  test('lightAlpha 0 → 1 → 0', () => {
    expect(lightAlpha(0)).toBe(0);
    expect(lightAlpha(0.5)).toBeCloseTo(1, 9);
    expect(lightAlpha(1)).toBe(0);
  });
});

describe('tư thế đích của mảnh', () => {
  const base = { layout, trayIndex: 0, trayCount: 2, selected: false, showTarget: false, drag: null };

  test('khay: tâm ô khay, scale = bán kính khay / bán kính bàn', () => {
    const pose = pieceTargetPose(d1, { kind: 'tray', turns: 0 }, base);
    const hit = pieceHitbox(d1, { kind: 'tray', turns: 0 }, layout, 0, 2);
    expect(pose.x).toBe(hit.x + hit.width / 2);
    expect(pose.y).toBe(hit.y + hit.height / 2);
    expect(pose.scale).toBeCloseTo(52 / 120, 9);
    expect(pose.alpha).toBe(0.9);
  });

  test('khay: các mảnh khác cỡ giữ đúng tỉ lệ với nhau, mảnh lớn nhất vừa ô', () => {
    const lv = loadLevel('2-1', 'campaign');
    const ref = largestFrameSize(lv.pieces);
    const input = { ...base, trayCount: lv.pieces.length, trayRefFrame: ref };
    // Bigger frame is drawn bigger, but softened (sqrt) so small pieces do not shrink to specks
    const drawn = lv.pieces.map((p) => ({
      frame: p.frameSize,
      radius: pieceTargetPose(p, { kind: 'tray', turns: 0 }, input).scale * pieceRadiusPx(p.frameSize, layout),
    }));
    expect(new Set(lv.pieces.map((p) => p.frameSize)).size).toBeGreaterThan(1);
    const big = drawn.find((d) => d.frame === ref)!;
    const small = drawn.find((d) => d.frame < ref)!;
    expect(small.radius).toBeLessThan(big.radius);
    expect(small.radius / big.radius).toBeCloseTo(Math.sqrt(small.frame / ref), 6);
    const biggest = lv.pieces.find((p) => p.frameSize === ref)!;
    const pose = pieceTargetPose(biggest, { kind: 'tray', turns: 0 }, input);
    expect(pose.scale * pieceRadiusPx(ref, layout)).toBeCloseTo(trayPieceRadiusPx(layout, lv.pieces.length), 6);
  });

  test('khay: không có mốc chung thì giữ cách cũ, mỗi mảnh tự co cho vừa ô', () => {
    const lv = loadLevel('2-1', 'campaign');
    const input = { ...base, trayCount: lv.pieces.length };
    for (const p of lv.pieces) {
      const pose = pieceTargetPose(p, { kind: 'tray', turns: 0 }, input);
      expect(pose.scale * pieceRadiusPx(p.frameSize, layout)).toBeCloseTo(trayPieceRadiusPx(layout, lv.pieces.length), 6);
    }
  });

  test('snap: tâm khung tại neo, scale 1', () => {
    const anchor = d1.anchors[0];
    const pose = pieceTargetPose(d1, { kind: 'snapped', anchorId: anchor.id, turns: 0 }, base);
    expect({ x: pose.x, y: pose.y }).toEqual(pieceCenterCanvas(d1.frameSize, anchor.x, anchor.y, layout));
    expect(pose.scale).toBe(1);
    expect(pose.alpha).toBe(1);
  });

  test('màn đặt tự do (placed): tâm khung tại gốc đã đặt, scale 1 như mảnh khớp neo, không thu về cỡ khay', () => {
    const state = { kind: 'placed', x: 40, y: 64, turns: 0 } as const;
    const pose = pieceTargetPose(d1, state, base);
    expect({ x: pose.x, y: pose.y }).toEqual(pieceCenterCanvas(d1.frameSize, 40, 64, layout));
    expect(pose.scale).toBe(1);
    expect(pose.alpha).toBe(1);
    // Mắt bật: hình đã dựng lùi lại như mảnh khớp neo
    expect(pieceTargetPose(d1, state, { ...base, showTarget: true }).alpha).toBe(FEEDBACK_TOKENS.eyeResultAlpha);
  });

  test('tạm: alpha 0.6, chọn thì 0.85', () => {
    const state = { kind: 'temporary', x: 16, y: 56, turns: 0 } as const;
    expect(pieceTargetPose(d1, state, base).alpha).toBe(0.6);
    expect(pieceTargetPose(d1, state, { ...base, selected: true }).alpha).toBe(0.85);
  });

  test('đang kéo: bám pointer; có neo ứng viên thì bị hút 30% và alpha 1', () => {
    const tray = { kind: 'tray', turns: 0 } as const;
    const free = pieceTargetPose(d1, tray, { ...base, drag: { x: 300, y: 500, candidate: null } });
    expect(free).toMatchObject({ x: 300, y: 500, scale: 1, alpha: PIECE_TOKENS.ghostAlpha });
    const hooked = pieceTargetPose(d1, tray, { ...base, drag: { x: 300, y: 500, candidate: { x: 400, y: 500 } } });
    expect(hooked).toMatchObject({ x: 330, y: 500, alpha: 1 });
  });

  test('anchorCenter trả tâm khung của neo, neo lạ thì null', () => {
    const anchor = d1.anchors[0];
    expect(anchorCenter(d1, anchor.id, layout)).toEqual(pieceCenterCanvas(d1.frameSize, anchor.x, anchor.y, layout));
    expect(anchorCenter(d1, 'không-có', layout)).toBeNull();
  });
});

describe('magnetRing', () => {
  const R = 40;

  test('sits tight and bright when the piece is on the anchor', () => {
    const ring = magnetRing(0, R);
    expect(ring.radius).toBeCloseTo(R * FEEDBACK_TOKENS.magnetRingNearRatio, 6);
    expect(ring.alpha).toBeCloseTo(FEEDBACK_TOKENS.magnetRingAlphaNear, 6);
  });

  test('tightens and brightens as the piece closes', () => {
    const far = magnetRing(R * FEEDBACK_TOKENS.magnetRingSpanRatio, R);
    const mid = magnetRing(R * FEEDBACK_TOKENS.magnetRingSpanRatio * 0.5, R);
    const near = magnetRing(0, R);
    expect(far.radius).toBeGreaterThan(mid.radius);
    expect(mid.radius).toBeGreaterThan(near.radius);
    expect(far.alpha).toBeLessThan(mid.alpha);
    expect(mid.alpha).toBeLessThan(near.alpha);
  });

  test('clamps beyond the span instead of overshooting', () => {
    const edge = magnetRing(R * FEEDBACK_TOKENS.magnetRingSpanRatio, R);
    const beyond = magnetRing(R * 100, R);
    expect(beyond.radius).toBeCloseTo(edge.radius, 6);
    expect(beyond.alpha).toBeCloseTo(edge.alpha, 6);
  });

  test('never draws inside the piece', () => {
    for (let d = 0; d <= R * 2; d += R / 20) {
      expect(magnetRing(d, R).radius).toBeGreaterThan(R);
    }
  });
});

describe('Eye crossfade', () => {
  const input = (over: Partial<PoseInput>): PoseInput => ({
    layout,
    trayIndex: 0,
    trayCount: 2,
    selected: false,
    showTarget: false,
    drag: null,
    ...over,
  });

  test('a snapped piece dims when the Eye is on', () => {
    const snapped = { kind: 'snapped', anchorId: d1.anchors[0].id, turns: 0 } as const;
    expect(pieceTargetPose(d1, snapped, input({ showTarget: false })).alpha).toBe(1);
    expect(pieceTargetPose(d1, snapped, input({ showTarget: true })).alpha).toBe(
      FEEDBACK_TOKENS.eyeResultAlpha
    );
  });

  test('the dragged piece never dims', () => {
    const dragging = input({
      showTarget: true,
      drag: { x: 100, y: 100, candidate: { x: 100, y: 100 } },
    });
    const snapped = { kind: 'snapped', anchorId: d1.anchors[0].id, turns: 0 } as const;
    expect(pieceTargetPose(d1, snapped, dragging).alpha).toBe(1);
  });

  test('the two alphas stay far enough apart to be told apart', () => {
    expect(FEEDBACK_TOKENS.eyeResultAlpha - FEEDBACK_TOKENS.eyeTargetAlpha).toBeGreaterThanOrEqual(0.15);
  });
});

