import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';
import { pressPlan, turnPeriod } from '../src/domain/linkedRotation.ts';
import type { Level, PuzzleState } from '../src/domain/model.ts';

/** Màn xoay liên động: tổng số lần bấm Xoay tối thiểu và kế hoạch dự kiến của người thiết kế. */
const EXPECTED: Record<string, { total: number; plan: Record<string, number> }> = {
  '3-8': { total: 4, plan: { T1: 3, P1: 1, S1: 0 } },
  '3-9': { total: 3, plan: { S1: 0, R1: 2, F1: 0, F2: 1 } },
  '3-10': { total: 5, plan: { S1: 1, R1: 1, F1: 1, F2: 2, P1: 0 } },
};
const LINKED = Object.keys(EXPECTED);

function setup(id: string) {
  const level = loadLevel(id, 'harness');
  const ids = level.pieces.map((p) => p.id);
  const drives: Record<string, string[]> = {};
  for (const piece of level.pieces) if (piece.drives?.length) drives[piece.id] = [...piece.drives];
  const target = Object.fromEntries((level.targetPlacements ?? []).map((t) => [t.pieceId, t.turns]));
  const periods = Object.fromEntries(level.pieces.map((p) => [p.id, turnPeriod(p.shapeKind)]));
  return { level, ids, drives, target, periods, plan: pressPlan(ids, drives, target, periods)! };
}

const press = (level: Level, state: PuzzleState, pieceId: string) =>
  applyCommand(level, state, { type: 'rotate', pieceId });

function drop(level: Level, state: PuzzleState, pieceId: string) {
  const t = (level.targetPlacements ?? []).find((p) => p.pieceId === pieceId)!;
  return applyCommand(level, state, { type: 'drop', pieceId, x: t.x, y: t.y });
}

/** Bấm theo kế hoạch trong khay (theo thứ tự `order`), rồi thả mọi mảnh vào chỗ. Trả về lệnh cuối. */
function playPlan(level: Level, plan: Record<string, number>, order: string[]) {
  let state = createPuzzle(level);
  const queue = order.flatMap((id) => Array.from({ length: plan[id] }, () => id));
  for (const id of queue) state = press(level, state, id).state;
  let last = drop(level, state, level.pieces[0].id);
  for (const piece of level.pieces.slice(1)) last = drop(level, last.state, piece.id);
  return last;
}

describe('Màn xoay liên động 3-8…3-10: dữ liệu', () => {
  test.each(LINKED)('%s: có liên kết, một chiều, không vòng, mọi id có thật', (id) => {
    const { level, drives } = setup(id);
    expect(level.rotationEnabled).toBe(true);
    expect(Object.keys(drives).length).toBeGreaterThan(0);
    for (const [driver, list] of Object.entries(drives)) {
      for (const follower of list) {
        expect(level.pieces.some((p) => p.id === follower)).toBe(true);
        expect(drives[follower] ?? []).not.toContain(driver);
      }
    }
  });

  test('3-9: một mảnh dẫn hai mảnh; 3-10: hai nhóm liên động, trong đó mảnh dẫn là hình vuông (xoay mà hình không đổi)', () => {
    expect(setup('3-9').drives).toEqual({ R1: ['F1', 'F2'] });
    const ten = setup('3-10');
    expect(ten.drives).toEqual({ S1: ['P1'], R1: ['F1', 'F2'] });
    expect(ten.level.pieces.find((p) => p.id === 'S1')!.shapeKind).toBe('square');
  });
});

describe('Màn xoay liên động: kế hoạch bấm và kết quả', () => {
  test.each(LINKED)('%s: kế hoạch tối thiểu đúng như thiết kế', (id) => {
    const { plan } = setup(id);
    expect(plan).toEqual(EXPECTED[id].plan);
    expect(Object.values(plan).reduce((a, b) => a + b, 0)).toBe(EXPECTED[id].total);
  });

  test.each(LINKED)('%s: bấm theo kế hoạch rồi thả thì thắng, ở mọi thứ tự bấm', (id) => {
    const { level, ids, plan } = setup(id);
    const orders = [ids, [...ids].reverse(), [...ids].sort((a, b) => (plan[b] - plan[a]) || a.localeCompare(b))];
    for (const order of orders) {
      const last = playPlan(level, plan, order);
      expect(last.outcome).toBe('won');
      expect(last.becameWon).toBe(true);
      expect(last.state.phase).toBe('won');
    }
  });

  test.each(LINKED)('%s: cách "ngây thơ" (mỗi mảnh bấm đúng số nấc đích, bỏ qua liên kết) không thắng', (id) => {
    const { level, ids, target } = setup(id);
    const last = playPlan(level, target, ids);
    expect(last.outcome).not.toBe('won');
    expect(last.state.phase).toBe('playing');
  });

  test.each(LINKED)('%s: thiếu một lần bấm hoặc thừa một lần bấm so với kế hoạch đều không thắng', (id) => {
    const { level, ids, plan, periods, drives } = setup(id);
    for (const pieceId of ids) {
      for (const delta of [-1, 1]) {
        const tweaked = { ...plan, [pieceId]: (plan[pieceId] + delta + 4) % 4 };
        // Bỏ qua điều chỉnh vô hại: mảnh đối xứng hoặc kéo theo chu kỳ trùng nấc đích
        const equivalent = ids.every((other) => {
          const fromDrivers = Object.entries(drives)
            .filter(([, list]) => list.includes(other))
            .reduce((sum, [driver]) => sum + tweaked[driver], 0);
          const turns = tweaked[other] + fromDrivers;
          const wanted = setup(id).target[other];
          return (((turns - wanted) % periods[other]) + periods[other]) % periods[other] === 0;
        });
        const last = playPlan(level, tweaked, ids);
        expect(last.outcome === 'won', `${id}: ${pieceId} ${delta > 0 ? '+1' : '-1'} bấm`).toBe(equivalent);
      }
    }
  });
});

describe('Màn xoay liên động: tác động lên mảnh đã đặt và một chiều', () => {
  test('3-8: xoay bình hành P1 không làm tam giác T1 xoay; xoay T1 kéo P1 xoay', () => {
    const { level } = setup('3-8');
    const state = createPuzzle(level);
    const byP = press(level, state, 'P1').state;
    expect([byP.pieces.T1.turns, byP.pieces.P1.turns, byP.pieces.S1.turns]).toEqual([0, 1, 0]);
    expect(press(level, state, 'T1').state.pieces.P1.turns).toBe(1);
  });

  test('3-9: đặt hai cánh đúng chỗ rồi xoay mũi R1 làm hai cánh quay khỏi chỗ (vẫn nằm ở chỗ cũ), mất khớp', () => {
    const { level, plan } = setup('3-9');
    let state = createPuzzle(level);
    for (const id of ['R1', 'R1']) state = press(level, state, id).state; // R1 = 2 nấc đúng; F1, F2 cùng lên 2
    for (let i = 0; i < plan.F2; i++) state = press(level, state, 'F2').state; // F2 lên 3 (đúng)
    for (const id of ['S1', 'F1', 'F2']) state = drop(level, state, id).state;
    expect(state.pieces.F1).toMatchObject({ kind: 'placed', turns: 2 });
    expect(state.pieces.F2).toMatchObject({ kind: 'placed', turns: 3 });
    const spoiled = press(level, state, 'R1');
    expect(spoiled.accepted).toBe(true);
    expect(spoiled.state.pieces.F1).toMatchObject({ kind: 'placed', turns: 3 });
    expect(spoiled.state.pieces.F2).toMatchObject({ kind: 'placed', turns: 0 });
    expect(spoiled.state.pieces.R1.turns).toBe(3);
    expect(spoiled.outcome).not.toBe('won');
  });

  test('3-10: xoay khối vuông S1 (hình không đổi) kéo bình hành P1 xoay; không kéo mảnh nhóm kia', () => {
    const { level } = setup('3-10');
    const state = createPuzzle(level);
    const after = press(level, state, 'S1').state;
    expect(after.pieces.S1.turns).toBe(1);
    expect(after.pieces.P1.turns).toBe(1);
    for (const id of ['R1', 'F1', 'F2']) expect(after.pieces[id].turns).toBe(0);
    // Xoay mũi R1 kéo hai cánh, không đụng S1/P1
    const nose = press(level, state, 'R1').state;
    for (const id of ['R1', 'F1', 'F2']) expect(nose.pieces[id].turns).toBe(1);
    for (const id of ['S1', 'P1']) expect(nose.pieces[id].turns).toBe(0);
  });

  test('3-10: thắng ngay ở lệnh xoay cuối khi mọi mảnh đã đặt, chỉ còn S1 chưa xoay (P1 sai chẵn lẻ)', () => {
    const { level, plan } = setup('3-10');
    // Làm đúng mọi thứ trừ việc bấm S1 (P1 vẫn nấc 0 = sai chẵn lẻ)
    let state = createPuzzle(level);
    for (const id of ['R1', 'F1', 'F2']) for (let i = 0; i < plan[id]; i++) state = press(level, state, id).state;
    let last = drop(level, state, level.pieces[0].id);
    for (const piece of level.pieces.slice(1)) last = drop(level, last.state, piece.id);
    expect(last.outcome).not.toBe('won');
    const finish = press(level, last.state, 'S1');
    expect(finish.outcome).toBe('won');
    expect(finish.becameWon).toBe(true);
  });
});
