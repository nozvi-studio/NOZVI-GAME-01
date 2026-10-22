import Phaser from 'phaser';
import { DEPTH_TOKENS, GRID_TOKENS } from '../designTokens.ts';
import { buildGridLayers, buildCornerMarks } from './gridLayers.ts';
import type { BoardBox, GridLayerName, Segment } from './gridLayers.ts';

type LayerStyle = {
  color: string;
  alpha: number;
  width: number;
  dash?: readonly number[];
};

const STYLE: Record<GridLayerName, LayerStyle> = {
  fine: GRID_TOKENS.fine,
  diagonal: GRID_TOKENS.diagonal,
  module: GRID_TOKENS.module,
  axis: GRID_TOKENS.axis,
  tick: GRID_TOKENS.tick,
};

/**
 * Lưới thước đo của bàn chơi.
 *
 * Lưới không đổi trong suốt màn chơi nên vẽ một lần vào RenderTexture. Vẽ
 * bằng Graphics mỗi khung hình là hàng trăm lệnh lineBetween không cần thiết.
 */
export class GridPainter {
  public static paint(
    scene: Phaser.Scene,
    board: BoardBox
  ): Phaser.GameObjects.RenderTexture {
    const texture = scene.add
      .renderTexture(board.x, board.y, board.width, board.height)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.boardGrid);

    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    for (const layer of buildGridLayers(board)) {
      const style = STYLE[layer.name];
      const color = Phaser.Display.Color.HexStringToColor(style.color).color;
      g.lineStyle(style.width, color, style.alpha);
      for (const s of layer.segments) {
        // Vẽ vào texture gốc (0, 0) nên mọi toạ độ phải trừ đi gốc bàn.
        // Quên một chỗ là cả lưới lệch đi đúng bằng vị trí bàn trên canvas.
        const local = GridPainter.toLocal(s, board);
        if (style.dash) {
          GridPainter.strokeDashed(g, local, style.dash);
        } else {
          g.lineBetween(local.x1, local.y1, local.x2, local.y2);
        }
      }
    }

    const corner = GRID_TOKENS.corner;
    g.lineStyle(corner.width, Phaser.Display.Color.HexStringToColor(corner.color).color, 1);
    for (const s of buildCornerMarks(board)) {
      const local = GridPainter.toLocal(s, board);
      g.lineBetween(local.x1, local.y1, local.x2, local.y2);
    }

    texture.draw(g);
    g.destroy();
    return texture;
  }

  private static toLocal(s: Segment, board: BoardBox): Segment {
    return {
      x1: s.x1 - board.x,
      y1: s.y1 - board.y,
      x2: s.x2 - board.x,
      y2: s.y2 - board.y,
    };
  }

  /** Phaser Graphics không có nét đứt, nên chia đoạn thủ công. */
  private static strokeDashed(
    g: Phaser.GameObjects.Graphics,
    s: Segment,
    dash: readonly number[]
  ): void {
    const [on, off] = dash;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const ux = dx / length;
    const uy = dy / length;

    let travelled = 0;
    while (travelled < length) {
      const segmentEnd = Math.min(travelled + on, length);
      g.lineBetween(
        s.x1 + ux * travelled,
        s.y1 + uy * travelled,
        s.x1 + ux * segmentEnd,
        s.y1 + uy * segmentEnd
      );
      travelled = segmentEnd + off;
    }
  }
}
