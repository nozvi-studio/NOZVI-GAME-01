import Phaser from 'phaser';
import { jewelOutline } from '../board/jewelGeometry.ts';

/** The ◆ motif, stroked. One function so every site agrees on the shape. */
export function strokeDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number
): void {
  const pts = jewelOutline(x, y, radius).map((p) => new Phaser.Geom.Point(p.x, p.y));
  g.strokePoints(pts, true);
}
