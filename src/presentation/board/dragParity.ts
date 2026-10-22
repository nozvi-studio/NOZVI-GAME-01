import { clipConvex, parityLayers, polygonArea } from './polygonClip.ts';
import type { ParityLayer, Pt } from './polygonClip.ts';

const MIN_OVERLAP_AREA = 1e-4;

/**
 * Computes real-time vector XOR parity layers between a floating/dragged piece polygon
 * and existing board polygons.
 *
 * Only layers that actively involve the dragged polygon are returned. Any static overlaps
 * between placed pieces that do not touch the dragged piece are excluded, ensuring
 * dragParityGraphics at depth 61 never paints over static board regions or temporary pieces.
 *
 * @param boardPolygons Polygons of pieces currently on the board (snapped, placed, or temporary).
 * @param dragPolygon Polygon of the piece currently being dragged (or null if none).
 * @returns Array of ParityLayer with depth >= 2 (even layers are hollow, odd layers >= 3 are revived).
 */
export function computeDragParityLayers(
  boardPolygons: readonly (readonly Pt[])[],
  dragPolygon: readonly Pt[] | null | undefined
): ParityLayer[] {
  if (!dragPolygon || dragPolygon.length < 3 || boardPolygons.length === 0) {
    return [];
  }

  // 1. Clip each board polygon against the drag polygon
  const clippedBoardPolygons: Array<readonly Pt[]> = [];
  for (const poly of boardPolygons) {
    const clipped = clipConvex(poly, dragPolygon);
    if (polygonArea(clipped) > MIN_OVERLAP_AREA) {
      clippedBoardPolygons.push(clipped);
    }
  }

  if (clippedBoardPolygons.length === 0) {
    return [];
  }

  // 2. Parity layers within the clipped board set:
  // depth 1 in clipped board set = 2 layers total (Drag + 1 board piece) -> even -> hollow (filled: false)
  // depth 2 in clipped board set = 3 layers total (Drag + 2 board pieces) -> odd -> revived (filled: true)
  // depth 3 in clipped board set = 4 layers total -> even -> hollow (filled: false)
  const baseLayers = parityLayers(clippedBoardPolygons);
  return baseLayers.map((layer) => {
    const totalDepth = 1 + layer.depth;
    return {
      points: layer.points,
      depth: totalDepth,
      filled: totalDepth % 2 === 1,
    };
  });
}
