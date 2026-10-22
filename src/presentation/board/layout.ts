import type { Piece, PieceState } from '../../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../../domain/model.ts';
import { effectiveOrientation, shapePolygon } from '../../domain/shapes.ts';
import type { Vertex } from '../../domain/shapes.ts';
import { LAYOUT_TOKENS } from '../designTokens.ts';

export type LayoutMetrics = {
  boardBounds: { x: number; y: number; width: number; height: number };
  cellPixel: 5;
  trayBounds: { x: number; y: number; width: number; height: number };
  headerBounds: { y: number; height: number };
  bottomBarBounds: { y: number; height: number };
  /** Tâm huy hiệu mục tiêu, bám mép trên bàn */
  targetBadgeY: number;
  /** Scale shared by the badge face, ring, silhouette and hit area. */
  targetBadgeScale: number;
  /** Chiều cao hệ toạ độ thiết kế trên máy này */
  designHeight: number;
  /** Lề an toàn đã áp dụng, theo đơn vị thiết kế */
  safeArea: { top: number; right: number; bottom: number; left: number };
  scale: number;
};

const BASE_WIDTH = LAYOUT_TOKENS.canvas.width;
const BASE_HEIGHT = LAYOUT_TOKENS.canvas.height;
const BOARD_X = LAYOUT_TOKENS.board.x;
const BOARD_Y = LAYOUT_TOKENS.board.y;
const BOARD_WIDTH = LAYOUT_TOKENS.board.width;
const BOARD_HEIGHT = LAYOUT_TOKENS.board.height;
const CELL_PIXEL: 5 = 5;
const TRAY_X = LAYOUT_TOKENS.tray.x;
const TRAY_Y = LAYOUT_TOKENS.tray.y;
const TRAY_WIDTH = LAYOUT_TOKENS.tray.width;
const TRAY_HEIGHT = LAYOUT_TOKENS.tray.height;

/** Khe hở giữa khay và thanh đáy trên artboard gốc (1164 - 1152). */
const TRAY_TO_BAR_GAP = LAYOUT_TOKENS.bottomBar.y - (TRAY_Y + TRAY_HEIGHT);

/**
 * Huy hiệu mục tiêu nằm cao hơn mép trên bàn đúng khoảng này.
 *
 * Lấy 22 chứ không phải hiệu của token (200 - 158 = 42): bản dựng thật đặt tâm
 * huy hiệu ở y=178 để đỉnh của nó không đè lên phụ đề chương. Token đã trôi
 * khỏi code từ trước; ở đây bám theo thứ đang hiển thị.
 */
const BADGE_ABOVE_BOARD = 22;

/**
 * Khoảng tối thiểu từ đáy header xuống mép trên bàn.
 *
 * Bằng đúng khoảng của artboard gốc (200 - 96). Hạ thấp hơn thì huy hiệu mục
 * tiêu — bán kính 94, tâm cao hơn bàn 22 — sẽ trùm lên dòng phụ đề chương.
 */
const MIN_BOARD_TOP_GAP = BOARD_Y - (LAYOUT_TOKENS.header.y + LAYOUT_TOKENS.header.height);

// Face radius 76 plus the outer glow's 4 units. Moving upward by the growth
// keeps the bottom edge's existing board overlap while using free header space.
const BADGE_OUTER_EXTENT = 80;

export function computeTargetBadgeScale(headerBottom: number, boardTop: number): number {
  const extraGap = boardTop - headerBottom - MIN_BOARD_TOP_GAP;
  return Math.max(1, Math.min(1.55, 1 + extraGap / (2 * BADGE_OUTER_EXTENT)));
}

/**
 * Bố cục dọc cho chiều cao màn thật.
 *
 * Bề ngang cố định 720 nên bàn giữ nguyên 640x800 và `cellPixel` vẫn là 5 —
 * mọi phép quy đổi lưới, hit-test và bán kính mảnh không đổi theo máy.
 *
 * Chiều dọc thì neo hai đầu rồi căn giữa phần còn lại: header bám mép trên và
 * thanh đáy bám mép dưới, cả hai lùi vào theo lề an toàn; khay nằm ngay trên
 * thanh đáy; bàn căn giữa khoảng trống giữa header và khay. Trên máy dài hơn
 * 9:16 phần dôi ra thành khoảng thở quanh bàn chứ không thành viền.
 */
export function computeLayout(
  designWidth: number,
  designHeight: number,
  safeArea: { top: number; right?: number; bottom: number; left?: number } = {
    top: 0,
    bottom: 0,
  }
): LayoutMetrics {
  const height = designHeight > 0 ? designHeight : BASE_HEIGHT;
  const width = designWidth > 0 ? designWidth : BASE_WIDTH;
  const safe = {
    top: Math.max(0, safeArea.top),
    right: Math.max(0, safeArea.right ?? 0),
    bottom: Math.max(0, safeArea.bottom),
    left: Math.max(0, safeArea.left ?? 0),
  };

  const headerY = safe.top;
  const headerHeight = LAYOUT_TOKENS.header.height;

  const bottomBarHeight = LAYOUT_TOKENS.bottomBar.height;
  const bottomBarY = height - safe.bottom - bottomBarHeight;

  const trayY = bottomBarY - TRAY_TO_BAR_GAP - TRAY_HEIGHT;

  // Căn giữa bàn trong khoảng trống giữa đáy header và đỉnh khay, nhưng không
  // để nó trôi lên đè vào header khi màn quá thấp.
  const slotTop = headerY + headerHeight;
  const centeredBoardY = slotTop + (trayY - slotTop - BOARD_HEIGHT) / 2;
  const boardY = Math.max(slotTop + MIN_BOARD_TOP_GAP, centeredBoardY);
  const targetBadgeScale = computeTargetBadgeScale(slotTop, boardY);

  return {
    boardBounds: {
      x: BOARD_X,
      y: boardY,
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
    },
    cellPixel: CELL_PIXEL,
    trayBounds: {
      x: TRAY_X,
      y: trayY,
      width: TRAY_WIDTH,
      height: TRAY_HEIGHT,
    },
    headerBounds: {
      y: headerY,
      height: headerHeight,
    },
    bottomBarBounds: {
      y: bottomBarY,
      height: bottomBarHeight,
    },
    targetBadgeY: boardY - BADGE_ABOVE_BOARD - BADGE_OUTER_EXTENT * (targetBadgeScale - 1),
    targetBadgeScale,
    designHeight: height,
    safeArea: safe,
    scale: width / BASE_WIDTH,
  };
}

export function canvasToGrid(
  canvasX: number,
  canvasY: number,
  layout: LayoutMetrics
): { x: number; y: number; insideBoard: boolean } {
  const relX = canvasX - layout.boardBounds.x;
  const relY = canvasY - layout.boardBounds.y;

  const x = Math.floor(relX / layout.cellPixel);
  const y = Math.floor(relY / layout.cellPixel);

  const insideBoard = x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
  return { x, y, insideBoard };
}

export function gridToCanvas(
  gridX: number,
  gridY: number,
  layout: LayoutMetrics
): { x: number; y: number } {
  return {
    x: layout.boardBounds.x + gridX * layout.cellPixel,
    y: layout.boardBounds.y + gridY * layout.cellPixel,
  };
}

/**
 * Gốc khung của mảnh đang nằm trên bàn: neo đã khớp, giao điểm lưới (màn
 * đặt tự do) hoặc vị trí tạm. Null khi mảnh ở khay.
 */
export function pieceBoardOrigin(piece: Piece, state: PieceState): { x: number; y: number } | null {
  if (state.kind === 'tray') return null;
  if (state.kind === 'snapped') {
    const anchor = piece.anchors.find((a) => a.id === state.anchorId) ?? piece.anchors[0];
    return { x: anchor.x, y: anchor.y };
  }
  return { x: state.x, y: state.y };
}

export function pieceHitbox(
  piece: Piece,
  state: PieceState,
  layout: LayoutMetrics,
  pieceIndexInTray: number = 0,
  trayCount: number = 2
): { x: number; y: number; width: number; height: number } {
  const rawSize = piece.frameSize * layout.cellPixel;
  const minTouchSize = 48; // Chuẩn tối thiểu 48 dp cho touch target
  const size = Math.max(rawSize, minTouchSize);

  const origin = pieceBoardOrigin(piece, state);
  if (origin) {
    const pos = gridToCanvas(origin.x, origin.y, layout);
    return {
      x: pos.x,
      y: pos.y,
      width: size,
      height: size,
    };
  }

  // Tray: chia đều bề ngang khay theo số mảnh của màn. Hitbox không rộng quá
  // một ô để mảnh cạnh nhau không giành nhau cú chạm.
  const slotWidth = traySlotWidth(layout, trayCount);
  const traySize = Math.max(Math.min(rawSize, slotWidth), minTouchSize);
  const centerX = layout.trayBounds.x + slotWidth * pieceIndexInTray + slotWidth / 2;
  const centerY = layout.trayBounds.y + layout.trayBounds.height / 2;

  return {
    x: centerX - traySize / 2,
    y: centerY - traySize / 2,
    width: traySize,
    height: traySize,
  };
}

/**
 * Tâm canvas của một mảnh, suy ra từ gốc khung và frameSize.
 *
 * Neo là GỐC khung mảnh (góc trên-trái), nên tâm bằng gốc cộng nửa khung.
 * Viết cứng nửa khung thành hằng số sẽ sai ngay khi frameSize đổi — đó
 * chính là lỗi đã xảy ra khi mảnh chuyển từ 40 sang 48 ô.
 */
export function pieceCenterCanvas(
  frameSize: number,
  originX: number,
  originY: number,
  layout: LayoutMetrics
): { x: number; y: number } {
  const half = frameSize / 2;
  return gridToCanvas(originX + half, originY + half, layout);
}

/** Bán kính vẽ hình thoi: nửa đường chéo thật, tính bằng pixel canvas. */
export function pieceRadiusPx(frameSize: number, layout: LayoutMetrics): number {
  return (frameSize / 2) * layout.cellPixel;
}

/**
 * Bán kính mảnh khi nằm trong khay.
 *
 * Khay thấp hơn bàn nhiều nên không dùng chung bán kính được: mảnh 48 ô ở
 * 5px/ô cao 240px, trong khi khay chỉ cao 160px và sẽ bị tràn. Chừa 16px
 * đệm trên dưới cho mảnh không chạm mép khung kính.
 * Khi khay chia nhiều ô, bán kính còn bị giới hạn bởi nửa bề rộng ô.
 */
export function trayPieceRadiusPx(layout: LayoutMetrics, trayCount: number = 2): number {
  return Math.min(
    layout.trayBounds.height / 2 - 16,
    traySlotWidth(layout, trayCount) / 2 - 16
  );
}

export type CanvasPoint = { x: number; y: number };

/** Đa giác của mảnh sau `turns` nấc xoay; mảnh không ghi hình (test domain) coi là thoi. */
function pieceVertices(piece: Piece, turns: number): Vertex[] {
  const kind = piece.shapeKind ?? 'diamond';
  const orientation = effectiveOrientation(kind, piece.orientation ?? 0, turns);
  return shapePolygon(kind, orientation, piece.frameSize);
}

/** Đa giác thật của mảnh trên bàn, gốc khung tại (originX, originY) ô logic. */
export function piecePolygonCanvas(
  piece: Piece,
  originX: number,
  originY: number,
  turns: number,
  layout: LayoutMetrics
): CanvasPoint[] {
  return pieceVertices(piece, turns).map((v) => gridToCanvas(originX + v.x, originY + v.y, layout));
}

/** Cùng hình nhưng đặt tâm khung tại (cx, cy), cạnh khung framePx pixel — cho khay và mảnh đang kéo. */
export function piecePolygonAround(
  piece: Piece,
  turns: number,
  cx: number,
  cy: number,
  framePx: number
): CanvasPoint[] {
  const s = piece.frameSize;
  return pieceVertices(piece, turns).map((v) => ({
    x: cx + (v.x / s - 0.5) * framePx,
    y: cy + (v.y / s - 0.5) * framePx,
  }));
}

export function traySlotWidth(layout: LayoutMetrics, trayCount: number): number {
  return layout.trayBounds.width / Math.max(1, trayCount);
}

/**
 * Ô lõm trong khay: lề 16px hai bên, khe 16px giữa các ô, đệm 14px trên dưới.
 * Với 2 ô cho đúng vị trí ô lõm của bản trước.
 */
export function trayWellRects(
  layout: LayoutMetrics,
  trayCount: number
): Array<{ x: number; y: number; width: number; height: number }> {
  const n = Math.max(1, trayCount);
  const gap = 16;
  const width = (layout.trayBounds.width - gap * (n + 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: layout.trayBounds.x + gap + i * (width + gap),
    y: layout.trayBounds.y + 14,
    width,
    height: layout.trayBounds.height - 28,
  }));
}

/** Điểm nằm trong đa giác, hoặc cách cạnh gần nhất không quá `pad` px (đệm cho ngón tay). */
export function pointNearPolygon(pt: CanvasPoint, poly: readonly CanvasPoint[], pad: number): boolean {
  let inside = false;
  let minDistSq = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
    minDistSq = Math.min(minDistSq, (pt.x - (a.x + t * dx)) ** 2 + (pt.y - (a.y + t * dy)) ** 2);
  }
  return inside || minDistSq <= pad * pad;
}
