import type { Pt } from './polygonClip.ts';

/** 2D affine matrix in canvas `setTransform(a, b, c, d, e, f)` order. */
export type Affine = Readonly<{ a: number; b: number; c: number; d: number; e: number; f: number }>;

type ClipContext = Pick<CanvasRenderingContext2D,
  'save' | 'setTransform' | 'beginPath' | 'rect' | 'moveTo' | 'lineTo' | 'closePath' | 'clip'> & {
  readonly canvas: { readonly width: number; readonly height: number };
};

/**
 * Clips the context to everything OUTSIDE the given holes (world-space polygons drawn
 * through `matrix`). Saves the context once; the caller restores it once.
 *
 * Why: Phaser's Canvas renderer ignores `GeometryMask.invertAlpha` and keeps only the last
 * filled polygon in its clip path, so an inverted hole mask clips the pieces to the holes
 * instead of out of them. That is what made overlapping pieces vanish entirely on devices
 * where Phaser falls back to Canvas (seen on iPhone).
 *
 * Each hole is cut with its own even-odd clip ("whole canvas minus this hole"). Canvas clips
 * intersect, so the result is the canvas minus the union of the holes, even when holes overlap.
 */
export function clipOutsideHoles(ctx: ClipContext, holes: readonly (readonly Pt[])[], matrix: Affine): void {
  ctx.save();
  for (const hole of holes) {
    if (hole.length < 3) continue;
    ctx.beginPath();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    ctx.moveTo(hole[0].x, hole[0].y);
    for (let i = 1; i < hole.length; i++) ctx.lineTo(hole[i].x, hole[i].y);
    ctx.closePath();
    ctx.clip('evenodd');
  }
}
