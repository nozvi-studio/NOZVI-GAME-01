import { describe, expect, test } from 'vitest';
import { buildLevelDocument } from '../src/content/authoring.ts';
import type { LevelSource } from '../src/content/authoring.ts';
import { validateLevel } from '../src/content/validate.ts';
import { piece } from '../src/content/kit.ts';
import { applyCommand, createPuzzle } from '../src/domain/session.ts';
import { pressPlan } from '../src/domain/linkedRotation.ts';
import type { Level, PuzzleState } from '../src/domain/model.ts';

type Links = Record<string, string[]>;

/** T (tam giác) dẫn Q (bình hành); S (vuông) không liên quan. Đặt theo neo, mỗi mảnh một neo A. */
function source(overrides: Partial<LevelSource> = {}, drives: Links = { T: ['Q'] }): LevelSource {
  const pieces = [
    piece('T', 'triangle', 32, [24, 56], { orientation: 0 }),
    piece('Q', 'parallelogram', 48, [88, 64], { orientation: 0 }),
    piece('S', 'square', 16, [24, 112], {}),
  ].map((p) => (drives[p.id] ? { ...p, drives: drives[p.id] } : p));
  return {
    id: 'test-link',
    title: 'Liên Động',
    chapter: 3,
    order: 99,
    contentRevision: 'test-link-v1',
    rotationEnabled: true,
    pieces,
    sampleSolutions: [
      [
        { pieceId: 'T', anchorId: 'A', turns: 1 },
        { pieceId: 'Q', anchorId: 'A', turns: 1 },
        { pieceId: 'S', anchorId: 'A', turns: 0 },
      ],
    ],
    learningObjective: 'test',
    difficultyEstimate: 3,
    distractors: [],
    ftueSteps: [],
    ...overrides,
  };
}

function load(src: LevelSource): Level {
  const result = validateLevel(buildLevelDocument(src));
  if (!result.ok) throw new Error(result.issues.map((i) => i.code).join(','));
  return result.level;
}

const turnsOf = (s: PuzzleState) => Object.fromEntries(Object.entries(s.pieces).map(([id, p]) => [id, p.turns]));
const anchorOf = (level: Level, id: string) => level.pieces.find((p) => p.id === id)!.anchors[0];

describe('Xoay liên động: lệnh rotate', () => {
  test('xoay mảnh dẫn thì mảnh bị dẫn xoay theo, mảnh khác đứng yên', () => {
    const level = load(source());
    const t = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'T' });
    expect(t.accepted).toBe(true);
    expect(t.outcome).toBe('rotated');
    expect(turnsOf(t.state)).toEqual({ T: 1, Q: 1, S: 0 });
  });

  test('xoay mảnh bị dẫn thì mảnh dẫn không xoay theo', () => {
    const level = load(source());
    const t = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'Q' });
    expect(turnsOf(t.state)).toEqual({ T: 0, Q: 1, S: 0 });
  });

  test('mảnh bị dẫn đã hít vào neo xoay tại chỗ, giữ nguyên neo', () => {
    const level = load(source());
    let state = createPuzzle(level);
    const q = anchorOf(level, 'Q');
    state = applyCommand(level, state, { type: 'drop', pieceId: 'Q', x: q.x, y: q.y }).state;
    expect(state.pieces.Q).toMatchObject({ kind: 'snapped', turns: 0 });
    const t = applyCommand(level, state, { type: 'rotate', pieceId: 'T' });
    expect(t.state.pieces.Q).toEqual({ kind: 'snapped', anchorId: 'A', turns: 1 });
    expect(t.state.pieces.T).toEqual({ kind: 'tray', turns: 1 });
  });

  test('xoay đủ 4 lần mảnh dẫn thì cả hai quay về nấc 0', () => {
    const level = load(source());
    let state = createPuzzle(level);
    for (let i = 0; i < 4; i++) state = applyCommand(level, state, { type: 'rotate', pieceId: 'T' }).state;
    expect(turnsOf(state)).toEqual({ T: 0, Q: 0, S: 0 });
  });

  test('một mảnh dẫn nhiều mảnh: tất cả cùng xoay; liên kết chỉ một bước, không lan', () => {
    const level = load(source({}, { T: ['Q', 'S'], Q: ['S'] }));
    const t = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'T' });
    // T dẫn Q và S; Q dẫn S nhưng không lan: S chỉ xoay một lần
    expect(turnsOf(t.state)).toEqual({ T: 1, Q: 1, S: 1 });
    const q = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'Q' });
    expect(turnsOf(q.state)).toEqual({ T: 0, Q: 1, S: 1 });
  });

  test('có mảnh bị dẫn không xoay được (vượt biên): từ chối cả lệnh, trạng thái không đổi', () => {
    const level = load(source());
    const base = createPuzzle(level);
    // Ép Q ra tư thế tạm sát mép phải: xoay một nấc làm khung thò ra ngoài bàn
    const edge: PuzzleState = { ...base, pieces: { ...base.pieces, Q: { kind: 'temporary', x: 100, y: 40, turns: 0 } } };
    const t = applyCommand(level, edge, { type: 'rotate', pieceId: 'T' });
    expect(t.accepted).toBe(false);
    expect(t.outcome).toBe('out-of-bounds');
    expect(t.state).toBe(edge);
  });
});

describe('Linked rotation: general graphs at runtime', () => {
  const turns = (state: PuzzleState) => ['T', 'Q', 'S'].map((id) => state.pieces[id].turns);

  test('asymmetric two-way links rotate only direct followers', () => {
    const level = load(source({}, { T: ['Q', 'S'], Q: ['T'] }));
    const first = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'Q' });
    expect(first.accepted).toBe(true);
    expect(turns(first.state)).toEqual([1, 1, 0]);
    const second = applyCommand(level, first.state, { type: 'rotate', pieceId: 'T' });
    expect(second.accepted).toBe(true);
    expect(turns(second.state)).toEqual([2, 2, 1]);
  });

  test('a three-piece cycle rotates only one level of links', () => {
    const level = load(source({}, { T: ['Q'], Q: ['S'], S: ['T'] }));
    const result = applyCommand(level, createPuzzle(level), { type: 'rotate', pieceId: 'T' });
    expect(result.accepted).toBe(true);
    expect(turns(result.state)).toEqual([1, 1, 0]);
  });
});

describe('Xoay liên động: kiểm tra kết quả (thắng/thua)', () => {
  type Step = ['rotate' | 'drop', string];
  const play = (level: Level, steps: Step[]) => {
    let state = createPuzzle(level);
    let last = applyCommand(level, state, { type: 'reset' });
    for (const [kind, id] of steps) {
      const a = anchorOf(level, id);
      last = applyCommand(
        level,
        state,
        kind === 'rotate' ? { type: 'rotate', pieceId: id } : { type: 'drop', pieceId: id, x: a.x, y: a.y }
      );
      state = last.state;
    }
    return last;
  };

  test('đường đi tối thiểu thắng: xoay T một lần (kéo theo Q) rồi thả cả ba', () => {
    const level = load(source());
    const last = play(level, [['rotate', 'T'], ['drop', 'T'], ['drop', 'Q'], ['drop', 'S']]);
    expect(last.outcome).toBe('won');
    expect(last.becameWon).toBe(true);
  });

  test('thả đủ mà chưa xoay thì chưa thắng', () => {
    const level = load(source());
    const last = play(level, [['drop', 'T'], ['drop', 'Q'], ['drop', 'S']]);
    expect(last.outcome).not.toBe('won');
  });

  test('Q đã đặt đúng rồi xoay T: Q bị kéo lệch, không thắng; xoay riêng Q thêm một nấc (thành nấc 3 cùng hình nấc 1) thì thắng', () => {
    const level = load(source());
    let last = play(level, [['rotate', 'Q'], ['drop', 'Q'], ['drop', 'S'], ['drop', 'T']]);
    expect(last.outcome).not.toBe('won');
    last = applyCommand(level, last.state, { type: 'rotate', pieceId: 'T' });
    expect(last.state.pieces.T.turns).toBe(1);
    expect(last.state.pieces.Q.turns).toBe(2);
    expect(last.outcome).not.toBe('won');
    // Q lên nấc 3: cùng hình với nấc 1 nên thắng ngay ở lần xoay riêng đầu tiên
    last = applyCommand(level, last.state, { type: 'rotate', pieceId: 'Q' });
    expect(last.state.pieces.Q.turns).toBe(3);
    expect(last.state.pieces.T.turns).toBe(1);
    expect(last.outcome).toBe('won');
  });

  test('thắng bằng đúng một lệnh xoay: ba mảnh đã đặt, xoay T kéo Q vào đúng chỗ', () => {
    const level = load(source());
    let last = play(level, [['drop', 'T'], ['drop', 'Q'], ['drop', 'S']]);
    expect(last.outcome).not.toBe('won');
    last = applyCommand(level, last.state, { type: 'rotate', pieceId: 'T' });
    expect(last.outcome).toBe('won');
    expect(last.becameWon).toBe(true);
    expect(last.state.phase).toBe('won');
  });

  test('bình hành 3 nấc cùng hình với 1 nấc nên thắng; 4 nấc (về 0) thì không', () => {
    const level = load(source());
    const wrong = play(level, [['rotate', 'Q'], ['rotate', 'Q'], ['rotate', 'Q'], ['rotate', 'T'], ['drop', 'T'], ['drop', 'Q'], ['drop', 'S']]);
    expect(wrong.state.pieces.Q.turns).toBe(0);
    expect(wrong.outcome).not.toBe('won');
    const ok = play(level, [['rotate', 'Q'], ['rotate', 'Q'], ['rotate', 'T'], ['drop', 'T'], ['drop', 'Q'], ['drop', 'S']]);
    expect(ok.state.pieces.Q.turns).toBe(3);
    expect(ok.outcome).toBe('won');
  });
});

describe('Xoay liên động: kế hoạch bấm (pressPlan)', () => {
  const ids = ['T', 'Q', 'S'];
  const single: Links = { T: ['Q'] };

  test('identical mutual buttons cannot reach different turns', () => {
    const mutual: Links = { T: ['Q'], Q: ['T'] };
    expect(pressPlan(['T', 'Q'], mutual, { T: 1, Q: 0 })).toBeNull();
    expect(pressPlan(['T', 'Q'], mutual, { T: 1, Q: 1 })).toEqual({ T: 1, Q: 0 });
  });

  test('an asymmetric two-way layout reaches every target', () => {
    // Adding S -> T makes I + D invertible modulo 4 (determinant -1).
    const asym: Links = { T: ['Q', 'S'], Q: ['T'], S: ['T'] };
    for (let t = 0; t < 4; t++) for (let q = 0; q < 4; q++) for (let s = 0; s < 4; s++) {
      const plan = pressPlan(ids, asym, { T: t, Q: q, S: s });
      expect(plan).not.toBeNull();
      expect((plan!.T + plan!.Q + plan!.S) % 4).toBe(t);
      expect((plan!.Q + plan!.T) % 4).toBe(q);
      expect((plan!.S + plan!.T) % 4).toBe(s);
    }
  });

  test('nghiệm T=1, Q=1: bấm T một lần, Q không cần bấm riêng', () => {
    expect(pressPlan(ids, single, { T: 1, Q: 1, S: 0 })).toEqual({ T: 1, Q: 0, S: 0 });
  });

  test('nghiệm T=1, Q=0: bấm T một lần rồi bấm Q ba lần để trả về', () => {
    expect(pressPlan(ids, single, { T: 1, Q: 0, S: 0 })).toEqual({ T: 1, Q: 3, S: 0 });
  });

  test('kế hoạch luôn tái tạo đúng nấc đích (mọi tổ hợp, liên kết nhiều mảnh)', () => {
    const multi: Links = { T: ['Q', 'S'], Q: ['S'] };
    for (let t = 0; t < 4; t++) {
      for (let q = 0; q < 4; q++) {
        for (let s = 0; s < 4; s++) {
          const target = { T: t, Q: q, S: s };
          const r = pressPlan(ids, multi, target)!;
          const final = Object.fromEntries(
            ids.map((id) => {
              const driven = Object.entries(multi)
                .filter(([, list]) => list.includes(id))
                .reduce((sum, [driver]) => sum + r[driver], 0);
              return [id, (r[id] + driven) % 4];
            })
          );
          expect(final).toEqual(target);
          for (const v of Object.values(r)) expect(v >= 0 && v <= 3).toBe(true);
        }
      }
    }
  });
});

describe('Xoay liên động: validator', () => {
  const codes = (src: LevelSource) => {
    const result = validateLevel(buildLevelDocument(src));
    return result.ok ? [] : result.issues.map((i) => i.code);
  };

  test('hợp lệ', () => {
    expect(codes(source())).toEqual([]);
  });

  test('drives ở màn không xoay', () => {
    const flat = source({
      rotationEnabled: false,
      chapter: 2,
      sampleSolutions: [
        [
          { pieceId: 'T', anchorId: 'A', turns: 0 },
          { pieceId: 'Q', anchorId: 'A', turns: 0 },
          { pieceId: 'S', anchorId: 'A', turns: 0 },
        ],
      ],
    });
    expect(codes(flat)).toContain('drives-without-rotation');
  });

  test('id lạ, tự dẫn, trùng', () => {
    expect(codes(source({}, { T: ['ZZ'] }))).toContain('drives-unknown-piece');
    expect(codes(source({}, { T: ['T'] }))).toContain('drives-self');
    expect(codes(source({}, { T: ['Q', 'Q'] }))).toContain('drives-duplicate');
  });

  test('cycles are allowed, but pure mutual links are degenerate', () => {
    expect(codes(source({}, { T: ['Q', 'S'], Q: ['T'] }))).toEqual([]);
    expect(codes(source({}, { T: ['Q'], Q: ['T'] }))).toContain('drives-degenerate');
    expect(codes(source({}, { T: ['Q'], Q: ['S'], S: ['T'] }))).toEqual([]);
  });

  test('rejects unreachable sample-solution turns', () => {
    const unreachable = source({}, { T: ['Q'], Q: ['T'] });
    unreachable.sampleSolutions[0] = unreachable.sampleSolutions[0].map((s) =>
      s.pieceId === 'Q' ? { ...s, turns: 0 } : s
    );
    expect(codes(unreachable)).toContain('drives-target-unreachable');
  });
});

describe('Xoay liên động: dấu liên kết trên mảnh', () => {
  test('vai: dẫn, bị dẫn, cả hai, không có', async () => {
    const { linkRole, linkRelated } = await import('../src/domain/linkedRotation.ts');
    const level = load(source({}, { T: ['Q'], Q: ['S'] }));
    expect(linkRole(level, 'T')).toBe('driver');
    expect(linkRole(level, 'Q')).toBe('both');
    expect(linkRole(level, 'S')).toBe('driven');
    expect(linkRole(load(source({}, {})), 'S')).toBeNull();
    // Chọn T: dấu của T và của Q (mảnh T dẫn) sáng, S không sáng
    expect(linkRelated(level, 'T', 'T')).toBe(true);
    expect(linkRelated(level, 'T', 'Q')).toBe(true);
    expect(linkRelated(level, 'T', 'S')).toBe(false);
    expect(linkRelated(level, null, 'T')).toBe(false);
  });
});

describe('Xoay liên động: lưu và khôi phục nguồn', () => {
  test('serializeLevelSource ghi drives và sourceFromDocument đọc lại đúng', async () => {
    const { serializeLevelSource } = await import('../src/content/serializeSource.ts');
    const { sourceFromDocument } = await import('../src/content/sourceFromDocument.ts');
    const src = source({}, { T: ['Q', 'S'] });
    const text = serializeLevelSource(src, 'lienDong');
    expect(text).toContain("drives: ['Q', 'S'],");
    expect(text.match(/drives:/g)).toHaveLength(1);
    const doc = buildLevelDocument(src);
    expect(doc.pieces.find((p) => p.id === 'T')!.drives).toEqual(['Q', 'S']);
    expect(doc.pieces.find((p) => p.id === 'Q')!.drives).toBeUndefined();
    const back = sourceFromDocument(doc);
    expect(back.pieces.find((p) => p.id === 'T')!.drives).toEqual(['Q', 'S']);
    expect(back.pieces.find((p) => p.id === 'Q')!.drives).toBeUndefined();
  });
});
