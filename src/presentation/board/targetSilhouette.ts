// Type-only Phaser import: erased at runtime, so this module can be imported
// by a Vitest test. Every module the tests reach (polygonClip, jewelGeometry,
// constellationMotion) follows the same rule. `fillPoints` accepts plain
// {x, y} objects, so no `Phaser.Geom.Point` is needed here — do not "fix"
// this to match BoardRenderer, which imports Phaser as a value.
import type Phaser from 'phaser';
import { effectiveOrientation, shapePolygon } from '../../domain/shapes.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../../domain/model.ts';
import type { Level } from '../../domain/model.ts';
import { parityLayers } from './polygonClip.ts';

/**
 * How much room the figure has, in the shape of the frame holding it.
 *
 * `box` suits a frame whose limit is a width and a height — the play badge's
 * gold ring, measured across its chord. `diamond` suits a frame whose limit is
 * `|x| + |y| <= budget`, which is what a map node actually is. Fitting a
 * diamond with a box wastes most of it: a fixed box cannot adapt to the
 * figure's own proportions, so a tall level ended up 17px wide inside a 96px
 * node. The diamond fit scales each level until its furthest point lands on
 * the budget, which is the largest it can legally be.
 */
export type SilhouetteFit =
  | { kind: 'box'; width: number; height: number }
  | { kind: 'diamond'; budget: number };

export type SilhouetteLayer = {
  filled: boolean;
  points: ReadonlyArray<{ x: number; y: number }>;
};

// Declared `as const` rather than as `SilhouetteFit`, so a caller reading
// `BADGE_SILHOUETTE_FIT.width` gets a `number` instead of having to narrow the
// union first — the same reason VR0 gave each motion family its own type.

/** Chord of the play badge's gold ring that the figure must stay inside. */
export const BADGE_SILHOUETTE_FIT = { kind: 'box', width: 92, height: 64 } as const;

/**
 * A map node is a diamond of radius 43. The budget is the furthest a point may
 * sit from the centre along `|x| + |y|`, so 36 leaves 7px of padding on the
 * axes and 4.9px on the diagonals. It was chosen against every approved level:
 * 39 let figures run within 2.8px of the diagonal edge, where they read as
 * biting into the node, and 33 would have shrunk the six levels that already
 * sat near the old limit. At 36 no level gets smaller than it was.
 */
export const NODE_SILHOUETTE_FIT = { kind: 'diamond', budget: 36 } as const;

type MaskBounds = { w: number; h: number; centerX: number; centerY: number };

/**
 * Khung của chính các đa giác sẽ được vẽ. Đo theo mask raster thì mất hàng đỉnh
 * của tam giác và bỏ sót vùng rỗng nằm ở mép (màn chồng mảnh như 2-3), nên hình
 * vẽ lố khỏi khung hoặc nhỏ hơn mức cho phép.
 */
function polygonBounds(level: Level): MaskBounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const placement of level.targetPlacements ?? []) {
    const piece = level.pieces.find((p) => p.id === placement.pieceId);
    if (!piece) continue;
    const kind = piece.shapeKind ?? 'diamond';
    const orientation = effectiveOrientation(kind, piece.orientation ?? 0, placement.turns);
    for (const v of shapePolygon(kind, orientation, piece.frameSize)) {
      minX = Math.min(minX, placement.x + v.x);
      maxX = Math.max(maxX, placement.x + v.x);
      minY = Math.min(minY, placement.y + v.y);
      maxY = Math.max(maxY, placement.y + v.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { w: maxX - minX, h: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

function maskBounds(level: Level): MaskBounds | null {
  let minX = GRID_WIDTH;
  let maxX = -1;
  let minY = GRID_HEIGHT;
  let maxY = -1;
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if ((level.targetMask[y * GRID_WIDTH + x] ?? 0) > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return null;
  // Mask rỗng thì không có hình để vẽ; còn lại ưu tiên khung đo trên đa giác.
  const fromPolygons = polygonBounds(level);
  if (fromPolygons && fromPolygons.w > 0 && fromPolygons.h > 0) return fromPolygons;
  return {
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
  };
}

/**
 * One path for every level: the sample solution's placements as vectors rather
 * than filled mask cells, which used to produce jagged edges.
 */
function targetPolygons(level: Level, b: MaskBounds, scale: number) {
  return (level.targetPlacements ?? []).flatMap((placement) => {
    const piece = level.pieces.find((p) => p.id === placement.pieceId);
    if (!piece) return [];
    const kind = piece.shapeKind ?? 'diamond';
    const orientation = effectiveOrientation(kind, piece.orientation ?? 0, placement.turns);
    return [
      shapePolygon(kind, orientation, piece.frameSize).map((v) => ({
        x: (placement.x + v.x - b.centerX) * scale,
        y: (placement.y + v.y - b.centerY) * scale,
      })),
    ];
  });
}

/**
 * Target figure as parity polygons, centred on the origin and scaled to `fit`.
 * Pure: no Phaser objects, so the fit can be tested without a renderer.
 */
export function silhouetteLayers(level: Level, fit: SilhouetteFit): SilhouetteLayer[] {
  const b = maskBounds(level);
  if (!b) return [];

  let scale: number;
  if (fit.kind === 'box') {
    scale = Math.min(fit.width / b.w, fit.height / b.h);
  } else {
    // Measured on the drawn vectors, not on the rasterised mask, because a
    // polygon tip can reach a cell past the mask bounds. |x| + |y| is convex,
    // so its maximum over a polygon is reached at a vertex — checking vertices
    // is exact, not an approximation.
    let reach = 0;
    for (const polygon of targetPolygons(level, b, 1)) {
      for (const p of polygon) reach = Math.max(reach, Math.abs(p.x) + Math.abs(p.y));
    }
    if (reach <= 0) return [];
    scale = fit.budget / reach;
  }

  return parityLayers(targetPolygons(level, b, scale)).map((layer) => ({
    filled: layer.filled,
    points: layer.points,
  }));
}

/** Draws what `silhouetteLayers` computes. Colours differ by surface. */
export function drawTargetSilhouette(
  g: Phaser.GameObjects.Graphics,
  level: Level,
  fit: SilhouetteFit,
  colors: { filled: number; hollow: number }
): void {
  for (const layer of silhouetteLayers(level, fit)) {
    g.fillStyle(layer.filled ? colors.filled : colors.hollow, 1);
    g.fillPoints(layer.points as Array<{ x: number; y: number }>, true);
  }
}
