import { describe, expect, test } from 'vitest';
import { loadLevel } from '../src/content/catalog.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';
import { turnedCells } from '../src/domain/geometry.ts';
import { GRID_WIDTH } from '../src/domain/model.ts';
import type { Level } from '../src/domain/model.ts';
import { validateLevel } from '../src/content/validate.ts';
import type { LevelDocument } from '../src/content/document.ts';
import rawLevel32 from '../src/content/levels/3-2.json';

const ANCHORED_IDS = ['3-1', '3-2', '3-3', '3-4'];
const FREE_IDS = ['3-5', '3-6', '3-7', '3-8', '3-9', '3-10'];

/** Phát lại nghiệm: xoay mảnh trong khay đủ số nấc rồi thả vào neo; trả về kết quả lệnh cuối. */
function replay(level: Level, skipRotation = false): string {
  let state = createPuzzle(level);
  let outcome = 'none';
  for (const target of (level.targetPlacements ?? [])) {
    const turns = skipRotation ? 0 : target.turns;
    for (let i = 0; i < turns; i++) {
      const rotated = applyCommand(level, state, { type: 'rotate', pieceId: target.pieceId });
      expect(rotated.outcome).toBe('rotated');
      state = rotated.state;
    }
    const dropped = applyCommand(level, state, { type: 'drop', pieceId: target.pieceId, x: target.x, y: target.y });
    state = dropped.state;
    outcome = dropped.outcome;
  }
  return outcome;
}

describe('Chương 3 Luân Chuyển: màn xoay 3-1…3-4 (đặt tự do từ 2026-10-13)', () => {
  test.each(ANCHORED_IDS)('%s: đặt tự do', (id) => {
    expect(loadLevel(id, 'harness').placement).toBe('free');
  });

  test.each([...ANCHORED_IDS, ...FREE_IDS])('%s: chương 3, bật xoay, nghiệm có nấc xoay và không chồng', (id) => {
    const level = loadLevel(id, 'harness');
    expect(level.chapter).toBe(3);
    expect(level.rotationEnabled).toBe(true);
    expect((level.targetPlacements ?? []).some((p) => p.turns > 0)).toBe(true);

    const covered = new Set<number>();
    for (const placement of (level.targetPlacements ?? [])) {
      const piece = level.pieces.find((p) => p.id === placement.pieceId)!;
      for (const [cx, cy] of turnedCells(piece, placement.turns)) {
        const index = (placement.y + cy) * GRID_WIDTH + (placement.x + cx);
        expect(covered.has(index)).toBe(false);
        covered.add(index);
      }
    }
  });

  test.each([...ANCHORED_IDS, '3-5', '3-6', '3-7'])('%s: xoay đủ nấc rồi thả vào vị trí thì thắng (màn không liên động)', (id) => {
    expect(replay(loadLevel(id, 'harness'))).toBe('won');
  });

  test.each(FREE_IDS)('%s: đặt tự do', (id) => {
    expect(loadLevel(id, 'harness').placement).toBe('free');
  });

  test.each([...ANCHORED_IDS, ...FREE_IDS])('%s: thả mà không xoay thì chưa thắng', (id) => {
    expect(replay(loadLevel(id, 'harness'), true)).not.toBe('won');
  });
});

describe('Màn xoay: mảnh giống nhau xuất hiện cùng một hướng ở khay', () => {
  const clone = (): LevelDocument => JSON.parse(JSON.stringify(rawLevel32)) as LevelDocument;
  const codes = (doc: LevelDocument) => {
    const result = validateLevel(doc);
    return result.ok ? [] : result.issues.map((i) => i.code);
  };

  test('3-2 hợp lệ: hai tam giác góc cùng hướng 0', () => {
    expect(codes(clone())).not.toContain('rotation-uniform-orientation');
  });

  test('hai tam giác cùng khung nhưng khác hướng khay báo rotation-uniform-orientation', () => {
    const doc = clone();
    doc.pieces.find((p) => p.id === 'T2')!.orientation = 2;
    expect(codes(doc)).toContain('rotation-uniform-orientation');
  });

  test('tam giác góc và tam giác mái là hai bộ khác nhau, không bị ép cùng hướng', () => {
    const doc = clone();
    const t2 = doc.pieces.find((p) => p.id === 'T2')!;
    t2.orientation = 4;
    t2.frameSize = 32;
    expect(codes(doc)).not.toContain('rotation-uniform-orientation');
  });
});
