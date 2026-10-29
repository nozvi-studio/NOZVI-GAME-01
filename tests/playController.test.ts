import { describe, expect, test } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { loadLevel } from '../src/content/catalog.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import type { StoragePort } from '../src/application/progressPort.ts';
import { PlayController } from '../src/application/playController.ts';
import { computeLayout, gridToCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';

function createMockStorage(): StoragePort & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, val) => {
      data[key] = val;
    },
  };
}

describe('PlayController Loop and State Coordination', () => {
  const layout = computeLayout(720, 1280);
  const level = loadLevel('1-1', 'harness');

  test('khởi tạo snapshot ban đầu chính xác', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);

    const snapshot = controller.getSnapshot();
    expect(snapshot.levelId).toBe('1-1');
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.matchedCount).toBe(0);
    expect(snapshot.totalPieces).toBe(2);
    expect(snapshot.canRotate).toBe(false); // Chapter 1 rotation is disabled
    expect(snapshot.showTarget).toBe(true);
  });

  test('chuỗi kéo thả hoàn thành màn 1-1, kích hoạt won và lưu vào progressRepo', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);

    const pD1 = level.pieces.find((p) => p.id === 'D1')!;
    const pD2 = level.pieces.find((p) => p.id === 'D2')!;

    // 1. Chạm vào D1 trong khay (slot 0)
    const p1Hitbox = pieceHitbox(pD1, { kind: 'tray', turns: 0 }, layout, 0);
    const hit1 = controller.onPointerDown(
      p1Hitbox.x + p1Hitbox.width / 2,
      p1Hitbox.y + p1Hitbox.height / 2,
      layout
    );
    expect(hit1).toBe(true);

    // Kéo D1 tới tâm neo A (40, 80)
    const anchor1Canvas = gridToCanvas(40, 80, layout);
    controller.onPointerMove(anchor1Canvas.x, anchor1Canvas.y, layout);

    const snap1 = controller.getSnapshot();
    expect(snap1.snapCandidateId).toBe('grid:16,56'); // free placement: nearest grid corner

    // Thả D1
    const trans1 = controller.onPointerUp(anchor1Canvas.x, anchor1Canvas.y, layout);
    expect(trans1?.outcome).toBe('snapped');
    expect(controller.getSnapshot().matchedCount).toBe(1);
    expect(controller.getSnapshot().phase).toBe('playing');

    // 2. Chạm vào D2 trong khay (slot 1)
    const p2Hitbox = pieceHitbox(pD2, { kind: 'tray', turns: 0 }, layout, 1);
    const hit2 = controller.onPointerDown(
      p2Hitbox.x + p2Hitbox.width / 2,
      p2Hitbox.y + p2Hitbox.height / 2,
      layout
    );
    expect(hit2).toBe(true);

    // Kéo D2 tới tâm neo A (88, 80)
    const anchor2Canvas = gridToCanvas(88, 80, layout);
    controller.onPointerMove(anchor2Canvas.x, anchor2Canvas.y, layout);

    // Thả D2 -> Thắng!
    const trans2 = controller.onPointerUp(anchor2Canvas.x, anchor2Canvas.y, layout);
    expect(trans2?.outcome).toBe('won');
    expect(trans2?.becameWon).toBe(true);

    const finalSnap = controller.getSnapshot();
    expect(finalSnap.phase).toBe('won');
    expect(finalSnap.matchedCount).toBe(2);

    // Xác nhận đã tự động lưu hoàn thành vào repo
    expect(repo.read().progress.completed).toContain('1-1');
  });

  test('thả mảnh bừa lên bàn thì X/N không tăng và không onTarget; chỉ đúng chỗ mới tăng', () => {
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);
    const goal = level.targetPlacements![0];
    const piece = level.pieces.find((p) => p.id === goal.pieceId)!;
    const index = level.pieces.indexOf(piece);
    const start = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, index);
    const centerOf = (x: number, y: number) => gridToCanvas(x + piece.frameSize / 2, y + piece.frameSize / 2, layout);

    expect(controller.onPointerDown(start.x + start.width / 2, start.y + start.height / 2, layout)).toBe(true);
    const wrong = centerOf(goal.x + 24, goal.y + 24);
    controller.onPointerMove(wrong.x, wrong.y, layout);
    expect(controller.getSnapshot().dragInfo?.onTarget).toBe(false);
    controller.onPointerUp(wrong.x, wrong.y, layout);
    expect(controller.getSnapshot().matchedCount).toBe(0);

    const hit = pieceHitbox(piece, controller.getPuzzleState().pieces[piece.id], layout, index);
    controller.onPointerDown(hit.x + hit.width / 2, hit.y + hit.height / 2, layout);
    const right = centerOf(goal.x, goal.y);
    controller.onPointerMove(right.x, right.y, layout);
    expect(controller.getSnapshot().dragInfo?.onTarget).toBe(true);
    controller.onPointerUp(right.x, right.y, layout);
    expect(controller.getSnapshot().matchedCount).toBe(1);
  });

  test('onToggleTarget thay đổi trạng thái hiển thị và lưu vào repository', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);

    const toggled = controller.onToggleTarget();
    expect(toggled).toBe(false);
    expect(controller.getSnapshot().showTarget).toBe(false);
    expect(repo.read().progress.settings.showTarget).toBe(false);
  });

  test('onReset đưa toàn bộ mảnh về khay và trả phase về playing', () => {
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);

    const pD1 = level.pieces.find((p) => p.id === 'D1')!;
    const p1Hitbox = pieceHitbox(pD1, { kind: 'tray', turns: 0 }, layout, 0);
    controller.onPointerDown(p1Hitbox.x + p1Hitbox.width / 2, p1Hitbox.y + p1Hitbox.height / 2, layout);

    const anchor1 = gridToCanvas(40, 80, layout);
    controller.onPointerUp(anchor1.x, anchor1.y, layout);
    expect(controller.getSnapshot().matchedCount).toBe(1);

    controller.onReset();
    const afterReset = controller.getSnapshot();
    expect(afterReset.matchedCount).toBe(0);
    expect(afterReset.phase).toBe('playing');
    expect(afterReset.selectedPieceId).toBeNull();
  });
});

describe('Màn đặt tự do thắng được qua PlayController (spec D mục 7)', () => {
  const layout = computeLayout(720, 1280);

  test('kéo bốn mảnh tới gần giao điểm đúng: nhãn hít grid, mảnh hít và màn thắng', () => {
    const level = loadLevel('dev-free-placement', 'harness');
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, false);

    let last = null as ReturnType<PlayController['onPointerUp']>;
    level.pieces.forEach((piece, index) => {
      const start = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, index, level.pieces.length);
      const anchor = piece.anchors[0];
      const center = gridToCanvas(anchor.x + piece.frameSize / 2, anchor.y + piece.frameSize / 2, layout);
      expect(controller.onPointerDown(start.x + start.width / 2, start.y + start.height / 2, layout)).toBe(true);
      // Lệch (+12, −12) px khỏi tâm đích = (+2, −3) ô: vẫn trong bán kính hít
      controller.onPointerMove(center.x + 12, center.y - 12, layout);
      expect(controller.getSnapshot().snapCandidateId).toBe(`grid:${anchor.x},${anchor.y}`);
      last = controller.onPointerUp(center.x + 12, center.y - 12, layout);
    });

    expect(last?.becameWon).toBe(true);
    expect(controller.getSnapshot().phase).toBe('won');
    expect(controller.getSnapshot().matchedCount).toBe(4);
    for (const piece of level.pieces) {
      expect(controller.getPuzzleState().pieces[piece.id].kind).toBe('placed');
    }
  });
});

describe('PlayController rotating while dragging', () => {
  const layout = computeLayout(720, 1280);

  function grab(levelId: string) {
    const level = loadLevel(levelId, 'harness');
    const storage = createMockStorage();
    const repo = createProgressRepository(storage, campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);
    const piece = level.pieces[0];
    const box = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, 0, level.pieces.length);
    expect(controller.onPointerDown(box.x + box.width / 2, box.y + box.height / 2, layout)).toBe(true);
    return { level, controller, piece };
  }

  test('turns the grabbed piece and keeps the drag going', () => {
    const { controller, piece } = grab('3-1');
    const before = controller.getPuzzleState().pieces[piece.id].turns;
    const transition = controller.onRotateDuringDrag(layout);
    expect(transition?.accepted).toBe(true);
    expect(controller.getPuzzleState().pieces[piece.id].turns).toBe((before + 1) % 4);
    expect(controller.getSnapshot().dragInfo?.pieceId).toBe(piece.id);
  });

  test('the drop that follows uses the new turns', () => {
    const { controller, piece } = grab('3-1');
    controller.onRotateDuringDrag(layout);
    controller.onRotateDuringDrag(layout);
    const target = gridToCanvas(64, 80, layout);
    controller.onPointerMove(target.x, target.y, layout);
    const done = controller.onPointerUp(target.x, target.y, layout);
    expect(done?.accepted).toBe(true);
    expect(controller.getPuzzleState().pieces[piece.id].turns).toBe(2);
  });

  test('does nothing without a drag or on a level without rotation', () => {
    const level = loadLevel('1-1', 'harness');
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    const controller = new PlayController(level, repo, true);
    expect(controller.onRotateDuringDrag(layout)).toBeNull();
    const { controller: chapter1 } = grab('1-1');
    expect(chapter1.onRotateDuringDrag(layout)).toBeNull();
  });
});

describe('PlayController.pieceAt', () => {
  const layout = computeLayout(720, 1280);
  const level = loadLevel('1-1', 'harness');
  const make = () => {
    const repo = createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1');
    return new PlayController(level, repo, true);
  };

  test('finds the piece under the pointer in the tray, and nothing elsewhere', () => {
    const controller = make();
    const hit = pieceHitbox(level.pieces[1], { kind: 'tray', turns: 0 }, layout, 1, level.pieces.length);
    expect(controller.pieceAt(hit.x + hit.width / 2, hit.y + hit.height / 2, layout)).toBe(level.pieces[1].id);
    expect(controller.pieceAt(10, 10, layout)).toBeNull();
  });

  test('has no side effects: no selection, no drag', () => {
    const controller = make();
    const hit = pieceHitbox(level.pieces[0], { kind: 'tray', turns: 0 }, layout, 0, level.pieces.length);
    controller.pieceAt(hit.x + hit.width / 2, hit.y + hit.height / 2, layout);
    const snapshot = controller.getSnapshot();
    expect(snapshot.selectedPieceId).toBeNull();
    expect(snapshot.dragInfo).toBeNull();
  });

  test('onPointerDown still selects and starts a drag on the same spot', () => {
    const controller = make();
    const hit = pieceHitbox(level.pieces[0], { kind: 'tray', turns: 0 }, layout, 0, level.pieces.length);
    const x = hit.x + hit.width / 2;
    const y = hit.y + hit.height / 2;
    expect(controller.onPointerDown(x, y, layout)).toBe(true);
    expect(controller.getSnapshot().selectedPieceId).toBe(controller.pieceAt(x, y, layout));
  });
});

describe('PlayController.onReturnToTray', () => {
  const layout = computeLayout(720, 1280);
  const level = loadLevel('1-1', 'harness');
  const make = () => new PlayController(level, createProgressRepository(createMockStorage(), campaignManifest, 'oracle-v1'), true);

  test('sends a dropped piece back to the tray', () => {
    const controller = make();
    const hit = pieceHitbox(level.pieces[0], { kind: 'tray', turns: 0 }, layout, 0, level.pieces.length);
    controller.onPointerDown(hit.x + hit.width / 2, hit.y + hit.height / 2, layout);
    controller.onPointerUp(360, 600, layout);
    expect(controller.getPuzzleState().pieces[level.pieces[0].id].kind).not.toBe('tray');

    const transition = controller.onReturnToTray(level.pieces[0].id);
    expect(transition?.accepted).toBe(true);
    expect(controller.getPuzzleState().pieces[level.pieces[0].id].kind).toBe('tray');
  });

  test('ignores an unknown piece', () => {
    expect(make().onReturnToTray('nope')).toBeNull();
  });
});
