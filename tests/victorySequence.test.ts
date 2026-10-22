import { describe, expect, test } from 'vitest';
import { VICTORY_CARD_GROUPS, VICTORY_FINALE, victoryCardTop, victoryEndMs, victoryPlan } from '../src/presentation/feedback/victorySequence.ts';
import { VICTORY_CARD, VICTORY_TOKENS } from '../src/presentation/designTokens.ts';

describe('lịch chuỗi thắng (kéo dài 4150 ms)', () => {
  test.each([1, 2, 3, 6])('%i mảnh: kết thúc đúng 4150 ms, mảnh sáng trong 400–1200', (n) => {
    const plan = victoryPlan(n, false);
    expect(victoryEndMs(plan)).toBe(4150);
    expect(plan.lightStartsMs).toHaveLength(n);
    expect(plan.lightStartsMs[0]).toBe(400);
    expect(Math.max(...plan.lightStartsMs) + plan.lightMs).toBeLessThanOrEqual(1200);
  });

  test('3 mảnh cách nhau 120 ms', () => {
    expect(victoryPlan(3, false).lightStartsMs).toEqual([400, 520, 640]);
  });

  test('≤ 30 hạt; vòng xong trước 4150', () => {
    const plan = victoryPlan(3, false);
    expect(plan.particles).toBeLessThanOrEqual(30);
    expect(plan.burstAtMs + VICTORY_TOKENS.ringGapMs + VICTORY_TOKENS.ringMs).toBeLessThanOrEqual(4150);
  });

  test('thẻ thắng: 4 nhóm, nhóm cuối kết thúc ở 4150', () => {
    const plan = victoryPlan(2, false);
    expect(plan.cardAtMs + (VICTORY_CARD_GROUPS - 1) * plan.cardItemGapMs + plan.cardItemMs).toBe(4150);
  });

  test('Giảm chuyển động: 150 ms, không hạt/vòng/vệt/flash/trượt', () => {
    const plan = victoryPlan(3, true);
    expect(victoryEndMs(plan)).toBe(150);
    expect(plan).toMatchObject({
      particles: 0, rings: false, cameraFlash: false, traceMs: 0, lightStartsMs: [], skyDim: null, cardSlidePx: 0,
    });
  });
});

describe('one focus at a time', () => {
  test('the trace closes no later than the burst opens', () => {
    const plan = victoryPlan(3, false);
    expect(plan.traceAtMs + plan.traceMs).toBeLessThanOrEqual(plan.burstAtMs);
  });

  test('the total length is unchanged at 4150ms', () => {
    expect(victoryEndMs(victoryPlan(3, false))).toBe(4150);
  });
});


describe('finale: pieces retract, the world dims, the card rises in the middle', () => {
  test.each([1, 3, 6])('%i mảnh: thu lại sau khi mảnh cuối nháy xong, trước khi thẻ hiện', (n) => {
    const plan = victoryPlan(n, false);
    expect(plan.retractAtMs).toBeGreaterThanOrEqual(Math.max(...plan.lightStartsMs) + plan.lightMs);
    expect(plan.retractAtMs + plan.retractMs).toBeLessThanOrEqual(plan.cardAtMs);
    expect(plan.retractDust).toBe(true);
  });

  test('nền mờ bắt đầu trước thẻ và xong trong 4150 ms', () => {
    const plan = victoryPlan(3, false);
    expect(plan.dimAtMs).toBeLessThan(plan.cardAtMs);
    expect(plan.dimAtMs + plan.dimMs).toBeLessThanOrEqual(4150);
    expect(plan.dimAlpha).toBe(VICTORY_FINALE.dimAlpha);
    expect(plan.dimAlpha).toBeLessThan(0.7);
    expect(plan.cardScaleFrom).toBeLessThan(1);
  });

  test('Giảm chuyển động: thu và mờ trong 150 ms, không bụi, thẻ không phóng', () => {
    const plan = victoryPlan(3, true);
    expect(plan).toMatchObject({ retractAtMs: 0, retractMs: 150, retractDust: false, dimAtMs: 0, dimMs: 150, cardScaleFrom: 1 });
    expect(victoryEndMs(plan)).toBe(150);
  });

  test('thẻ nằm chính giữa chiều cao màn', () => {
    for (const height of [1280, 1440, 1558]) {
      expect(victoryCardTop(height) + VICTORY_CARD.h / 2).toBeCloseTo(height / 2, 0);
    }
  });
});

describe('merge: the lit pieces fuse into one block before they go', () => {
  test.each([1, 3, 6])('%i mảnh: hợp nhất bắt đầu khi mảnh cuối sáng xong, thống nhất xong trước khi thu lại', (n) => {
    const plan = victoryPlan(n, false);
    expect(plan.mergeMs).toBeGreaterThan(0);
    expect(plan.unifyMs).toBeGreaterThan(0);
    expect(plan.paintMs).toBeGreaterThan(0);
    expect(plan.mergeAtMs).toBe(Math.max(...plan.lightStartsMs) + plan.paintMs);
    expect(plan.mergeAtMs + Math.max(plan.mergeMs, plan.unifyMs)).toBeLessThanOrEqual(plan.retractAtMs);
  });

  test('Giảm chuyển động: không có bước hợp nhất', () => {
    expect(victoryPlan(3, true)).toMatchObject({ mergeAtMs: 0, paintMs: 0, mergeMs: 0, unifyMs: 0 });
  });
});
