import type { StudioAction, StudioState } from './state.ts';

export type StudioKeyEvent = {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: any;
};

function isInputField(target: any): boolean {
  if (!target || typeof target !== 'object') return false;
  const tagName = target.tagName ? String(target.tagName).toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  return Boolean(target.isContentEditable);
}

/**
 * Ánh xạ sự kiện bàn phím sang StudioAction:
 * - R: xoay hướng kế tiếp trong họ
 * - Shift+R: lật gương
 * - Delete / Backspace: xoá mảnh (hoặc xoá neo nhiễu đang chọn)
 * - Ctrl+D / Cmd+D: nhân bản mảnh
 * - Mũi tên: dịch 8 ô
 * Bỏ qua khi người dùng đang gõ trong ô nhập liệu hoặc không chọn mảnh.
 */
export function keyToAction(event: StudioKeyEvent, state: StudioState): StudioAction | null {
  if (isInputField(event.target)) {
    return null;
  }

  const pieceId = state.selectedPieceId;
  if (!pieceId) {
    return null;
  }

  const key = event.key;
  const isCtrlOrMeta = Boolean(event.ctrlKey || event.metaKey);

  if (isCtrlOrMeta && (key === 'd' || key === 'D')) {
    return { type: 'duplicate-piece', id: pieceId };
  }

  if (key === 'r' || key === 'R') {
    if (event.shiftKey) {
      return { type: 'mirror-piece', id: pieceId };
    }
    return { type: 'rotate-piece', id: pieceId };
  }

  if (key === 'Delete' || key === 'Backspace') {
    if (state.selectedAnchorId && state.selectedAnchorId !== 'A') {
      return {
        type: 'delete-decoy',
        pieceId,
        anchorId: state.selectedAnchorId,
      };
    }
    return { type: 'delete-piece', id: pieceId };
  }

  if (key === 'ArrowUp') {
    return { type: 'nudge-piece', id: pieceId, dx: 0, dy: -8 };
  }
  if (key === 'ArrowDown') {
    return { type: 'nudge-piece', id: pieceId, dx: 0, dy: 8 };
  }
  if (key === 'ArrowLeft') {
    return { type: 'nudge-piece', id: pieceId, dx: -8, dy: 0 };
  }
  if (key === 'ArrowRight') {
    return { type: 'nudge-piece', id: pieceId, dx: 8, dy: 0 };
  }

  return null;
}
