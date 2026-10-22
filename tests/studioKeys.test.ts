import { describe, expect, test } from 'vitest';
import { levelTemplate } from '../src/content/sources/_template.ts';
import { createInitialState } from '../src/studio/state.ts';
import { keyToAction } from '../src/studio/keys.ts';

describe('keyToAction (spec E, ST-03)', () => {
  const baseState = createInitialState(levelTemplate);
  const selectedState = {
    ...baseState,
    selectedPieceId: baseState.source.pieces[0].id,
    selectedAnchorId: 'A',
  };

  test('bỏ qua khi không có mảnh nào được chọn', () => {
    const action = keyToAction({ key: 'r' }, baseState);
    expect(action).toBeNull();
  });

  test('bỏ qua khi sự kiện phát sinh từ ô nhập liệu', () => {
    const action = keyToAction(
      { key: 'r', target: { tagName: 'INPUT' } },
      selectedState
    );
    expect(action).toBeNull();

    const actionTextarea = keyToAction(
      { key: 'Delete', target: { tagName: 'TEXTAREA' } },
      selectedState
    );
    expect(actionTextarea).toBeNull();
  });

  test('R chuyển thành rotate-piece, Shift+R chuyển thành mirror-piece', () => {
    const rotate = keyToAction({ key: 'r' }, selectedState);
    expect(rotate).toEqual({
      type: 'rotate-piece',
      id: selectedState.selectedPieceId,
    });

    const mirror = keyToAction({ key: 'R', shiftKey: true }, selectedState);
    expect(mirror).toEqual({
      type: 'mirror-piece',
      id: selectedState.selectedPieceId,
    });
  });

  test('Delete / Backspace xoá mảnh nếu chọn neo A, xoá neo nhiễu nếu chọn neo khác', () => {
    const delPiece = keyToAction({ key: 'Delete' }, selectedState);
    expect(delPiece).toEqual({
      type: 'delete-piece',
      id: selectedState.selectedPieceId,
    });

    const decoySelectedState = {
      ...selectedState,
      selectedAnchorId: 'B',
    };
    const delDecoy = keyToAction({ key: 'Backspace' }, decoySelectedState);
    expect(delDecoy).toEqual({
      type: 'delete-decoy',
      pieceId: selectedState.selectedPieceId,
      anchorId: 'B',
    });
  });

  test('Ctrl+D và Cmd+D nhân bản mảnh', () => {
    const dupCtrl = keyToAction({ key: 'd', ctrlKey: true }, selectedState);
    expect(dupCtrl).toEqual({
      type: 'duplicate-piece',
      id: selectedState.selectedPieceId,
    });

    const dupMeta = keyToAction({ key: 'd', metaKey: true }, selectedState);
    expect(dupMeta).toEqual({
      type: 'duplicate-piece',
      id: selectedState.selectedPieceId,
    });
  });

  test('4 phím mũi tên dịch chuyển 8 ô', () => {
    const up = keyToAction({ key: 'ArrowUp' }, selectedState);
    expect(up).toEqual({
      type: 'nudge-piece',
      id: selectedState.selectedPieceId,
      dx: 0,
      dy: -8,
    });

    const down = keyToAction({ key: 'ArrowDown' }, selectedState);
    expect(down).toEqual({
      type: 'nudge-piece',
      id: selectedState.selectedPieceId,
      dx: 0,
      dy: 8,
    });

    const left = keyToAction({ key: 'ArrowLeft' }, selectedState);
    expect(left).toEqual({
      type: 'nudge-piece',
      id: selectedState.selectedPieceId,
      dx: -8,
      dy: 0,
    });

    const right = keyToAction({ key: 'ArrowRight' }, selectedState);
    expect(right).toEqual({
      type: 'nudge-piece',
      id: selectedState.selectedPieceId,
      dx: 8,
      dy: 0,
    });
  });
});
