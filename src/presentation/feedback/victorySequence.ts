import { VICTORY_CARD, VICTORY_TOKENS } from '../designTokens.ts';
import { stagger } from '../transitions/motion.ts';

/** Nhãn, câu kiến thức, hàng nút */
export const VICTORY_CARD_GROUPS = 3;

/**
 * Cuối chuỗi thắng: mảnh nháy sáng rồi thu lại ngay, nền mờ nhẹ, thẻ hoàn thành
 * nổi lên giữa màn. Bấm tiếp thì thẻ thu lại như các mảnh (VICTORY_COLLAPSE_MS)
 * trước khi chuyển màn.
 */
export const VICTORY_FINALE = {
  retractAtMs: 2300,
  retractMs: 750,
  dimAtMs: 2500,
  dimMs: 800,
  dimAlpha: 0.5,
  cardScaleFrom: 0.86,
  /** The card waits for the pieces to finish retracting, then takes its time to arrive. */
  cardAtMs: 3050,
  cardMs: 1100,
  cardItemGapMs: 140,
  /** Độ cao tối đa thẻ trồi lên khi hiện, ngoài hiệu ứng phóng to. */
  cardRisePx: 28,
} as const;

export const VICTORY_COLLAPSE_MS = 560;
/** Tỉ lệ thẻ khi đã thu hết, trước khi biến mất. */
export const VICTORY_COLLAPSE_SCALE = 0.55;

/** Đỉnh thẻ hoàn thành khi đặt chính giữa chiều cao màn. */
export function victoryCardTop(designHeight: number): number {
  return Math.round(designHeight / 2 - VICTORY_CARD.h / 2);
}

export type VictoryPlan = {
  totalMs: number;
  skyDim: { atMs: number; ms: number; extra: number } | null;
  lightStartsMs: number[];
  lightMs: number;
  lightPeak: number;
  traceAtMs: number;
  traceMs: number;
  /** Starts when the last piece has lit; 0 ms means no merge step. */
  mergeAtMs: number;
  /** How long the jewel material takes to wipe over one piece. */
  paintMs: number;
  mergeMs: number;
  unifyMs: number;
  burstAtMs: number;
  particles: number;
  particleMs: number;
  rings: boolean;
  cameraFlash: boolean;
  frameAtMs: number;
  frameMs: number;
  trayFadeMs: number;
  /** Mảnh và bóng mục tiêu thu lại sau khi nháy sáng. */
  retractAtMs: number;
  retractMs: number;
  /** Bụi sao hút vào tâm bia khi thu; tắt khi Giảm chuyển động. */
  retractDust: boolean;
  dimAtMs: number;
  dimMs: number;
  dimAlpha: number;
  cardScaleFrom: number;
  cardAtMs: number;
  cardMs: number;
  cardSlidePx: number;
  cardItemGapMs: number;
  cardItemMs: number;
};

function lightStartsMsFor(pieceCount: number, span: number): number[] {
  return Array.from({ length: pieceCount }, (_, i) => VICTORY_TOKENS.lightsAtMs + stagger(i, pieceCount, span));
}

export function victoryPlan(pieceCount: number, reduced: boolean): VictoryPlan {
  const T = VICTORY_TOKENS;
  if (reduced) {
    const ms = T.reducedMs;
    return {
      totalMs: ms,
      skyDim: null,
      lightStartsMs: [],
      lightMs: 0,
      lightPeak: 0,
      traceAtMs: 0,
      traceMs: 0,
      mergeAtMs: 0,
      paintMs: 0,
      mergeMs: 0,
      unifyMs: 0,
      burstAtMs: 0,
      particles: 0,
      particleMs: 0,
      rings: false,
      cameraFlash: false,
      frameAtMs: 0,
      frameMs: ms,
      trayFadeMs: ms,
      retractAtMs: 0,
      retractMs: ms,
      retractDust: false,
      dimAtMs: 0,
      dimMs: ms,
      dimAlpha: VICTORY_FINALE.dimAlpha,
      cardScaleFrom: 1,
      cardAtMs: 0,
      cardMs: ms,
      cardSlidePx: 0,
      cardItemGapMs: 0,
      cardItemMs: ms,
    };
  }
  // Nhiều mảnh thì thu khoảng cách để mảnh cuối vẫn tắt trước 900 ms
  const span = Math.min(T.lightGapMs * Math.max(0, pieceCount - 1), T.lightsEndMs - T.lightsAtMs - T.lightMs);
  return {
    totalMs: VICTORY_FINALE.cardAtMs + VICTORY_FINALE.cardMs,
    skyDim: { atMs: T.skyDimAtMs, ms: T.skyDimMs, extra: T.skyDimExtra },
    lightStartsMs: lightStartsMsFor(pieceCount, span),
    lightMs: T.lightMs,
    lightPeak: T.lightPeak,
    traceAtMs: T.traceAtMs,
    traceMs: T.traceMs,
    mergeAtMs: Math.max(T.lightsAtMs, ...lightStartsMsFor(pieceCount, span)) + T.paintMs,
    paintMs: T.paintMs,
    mergeMs: T.mergeMs,
    unifyMs: T.unifyMs,
    burstAtMs: T.burstAtMs,
    particles: T.particles,
    particleMs: T.particleMs,
    rings: true,
    cameraFlash: true,
    frameAtMs: T.frameAtMs,
    frameMs: T.frameMs,
    trayFadeMs: T.trayFadeMs,
    retractAtMs: VICTORY_FINALE.retractAtMs,
    retractMs: VICTORY_FINALE.retractMs,
    retractDust: true,
    dimAtMs: VICTORY_FINALE.dimAtMs,
    dimMs: VICTORY_FINALE.dimMs,
    dimAlpha: VICTORY_FINALE.dimAlpha,
    cardScaleFrom: VICTORY_FINALE.cardScaleFrom,
    cardAtMs: VICTORY_FINALE.cardAtMs,
    cardMs: VICTORY_FINALE.cardMs,
    cardSlidePx: T.cardSlidePx,
    cardItemGapMs: VICTORY_FINALE.cardItemGapMs,
    cardItemMs: VICTORY_FINALE.cardMs - VICTORY_FINALE.cardItemGapMs * (VICTORY_CARD_GROUPS - 1),
  };
}

export function victoryEndMs(plan: VictoryPlan): number {
  const T = VICTORY_TOKENS;
  return Math.max(
    ...plan.lightStartsMs.map((s) => s + plan.lightMs),
    plan.traceAtMs + plan.traceMs,
    plan.mergeAtMs + Math.max(plan.mergeMs, plan.unifyMs),
    plan.rings ? plan.burstAtMs + T.ringGapMs + T.ringMs : 0,
    plan.burstAtMs + plan.particleMs,
    plan.frameAtMs + Math.max(plan.frameMs, plan.trayFadeMs),
    plan.retractAtMs + plan.retractMs,
    plan.dimAtMs + plan.dimMs,
    plan.cardAtMs + plan.cardMs,
    plan.cardAtMs + (VICTORY_CARD_GROUPS - 1) * plan.cardItemGapMs + plan.cardItemMs
  );
}
