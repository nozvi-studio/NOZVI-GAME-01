import { describe, expect, it } from 'vitest';
import { anchorLevel } from './fixtures/anchorLevels.ts';
import { createPuzzle } from '../src/domain/session.ts';
import { beginDrag, finishDrag } from '../src/application/drag.ts';
import { PlayController } from '../src/application/playController.ts';
import { createProgressRepository } from '../src/infrastructure/progressRepository.ts';
import { campaignManifest } from '../src/content/manifest.ts';
import { computeLayout, gridToCanvas, pieceCenterCanvas, pieceHitbox } from '../src/presentation/board/layout.ts';

const layout = computeLayout(720, 1280);
const level = anchorLevel('1-4');

describe('1-4: mảnh bù nhau dùng chung neo, chọn mảnh theo đa giác', () => {
  it('T4 khớp được neo (56,48) khi T3 đã nằm đó', () => {
    const drop = (state: ReturnType<typeof createPuzzle>, id: string, idx: number) => {
      const piece = level.pieces.find((p) => p.id === id)!;
      const hb = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, idx, level.pieces.length);
      const c = pieceCenterCanvas(piece.frameSize, piece.anchors[0].x, piece.anchors[0].y, layout);
      const session = beginDrag(state, piece, hb.x + hb.width / 2, hb.y + hb.height / 2, layout, idx, level.pieces.length);
      return finishDrag(session, level, c.x, c.y, layout);
    };
    const first = drop(createPuzzle(level), 'T3', 4);
    expect(first?.state.pieces.T3.kind).toBe('snapped');
    const second = drop(first!.state, 'T4', 5);
    expect(second?.state.pieces.T4.kind).toBe('snapped');
  });

  it('chạm trong T3 chọn T3, không bị khung vuông của T5 che', () => {
    const repo = createProgressRepository(
      { getItem: () => null, setItem: () => {} },
      campaignManifest,
      'oracle-v1'
    );
    const controller = new PlayController(anchorLevel('1-4'), repo, true);
    (controller as unknown as { puzzleState: unknown }).puzzleState = {
      levelId: '1-4',
      phase: 'playing',
      pieces: Object.fromEntries(level.pieces.map((p) => [p.id, { kind: 'snapped', anchorId: 'A', turns: 0 }])),
    };
    const p = gridToCanvas(58, 52, layout);
    expect(controller.onPointerDown(p.x, p.y, layout)).toBe(true);
    expect(controller.getSnapshot().selectedPieceId).toBe('T3');
  });
});
