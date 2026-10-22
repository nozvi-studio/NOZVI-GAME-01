import type { Orientation, PlacementMode, ShapeKind } from '../domain/model.ts';
import { isValidFrame, isValidOrientation, mirrorOrientation } from '../domain/shapes.ts';
import { ANCHOR_STEP } from './authoring.ts';
import type { PieceSource } from './authoring.ts';

/** Độ lệch neo nhiễu [dx, dy] so với neo A, đơn vị ô logic (bội của 8). */
export type DecoyOffsets = ReadonlyArray<readonly [number, number]>;

export type PieceOptions = {
  orientation?: Orientation;
  decoys?: DecoyOffsets;
  /** 'free': màn đặt tự do, bỏ qua decoys (mọi giao điểm lưới đã là neo nhiễu) */
  placement?: PlacementMode;
};

/** Mô tả một mảnh trong `concentric`: cùng tâm, khác hình/khung/hướng. */
export type PieceSpec = {
  id: string;
  kind: ShapeKind;
  size: number;
  orientation?: Orientation;
  decoys?: DecoyOffsets;
};

/** Ba neo nhiễu sát: lệch phải, lệch trái, lệch xuống 8 ô. */
export const NUDGE: DecoyOffsets = [[8, 0], [-8, 0], [0, 8]];
/** Bốn neo nhiễu chữ thập: lệch phải, trái, xuống, lên 8 ô. */
export const CROSS: DecoyOffsets = [[8, 0], [-8, 0], [0, 8], [0, -8]];
/** Neo A là vị trí đúng; neo nhiễu đặt tên lần lượt B–F. */
export const DECOY_IDS = ['B', 'C', 'D', 'E', 'F'] as const;

function onGrid(value: number): boolean {
  return Number.isInteger(value) && value % ANCHOR_STEP === 0;
}

/**
 * Đặt mảnh theo tâm khung. Gốc khung = tâm − khung/2, phải là bội của 8.
 * Khung phải hợp lệ cho loại hình (bảng spec A mục 3).
 */
export function piece(
  id: string,
  kind: ShapeKind,
  size: number,
  center: readonly [number, number],
  opts: PieceOptions = {}
): PieceSource {
  const orientation = opts.orientation ?? 0;
  if (!isValidOrientation(kind, orientation)) {
    throw new Error(`piece ${id}: hướng ${orientation} không hợp lệ cho ${kind}`);
  }
  if (!isValidFrame(kind, orientation, size)) {
    throw new Error(`piece ${id}: khung ${size} không hợp lệ cho ${kind} hướng ${orientation}`);
  }
  const [cx, cy] = center;
  const x = cx - size / 2;
  const y = cy - size / 2;
  if (!onGrid(x) || !onGrid(y)) {
    throw new Error(
      `piece ${id}: tâm (${cx}, ${cy}) cho gốc khung (${x}, ${y}), không phải bội của ${ANCHOR_STEP}`
    );
  }
  const decoys = opts?.placement === 'free' ? [] : (opts?.decoys ?? []);
  if (decoys.length > DECOY_IDS.length) {
    throw new Error(`piece ${id}: tối đa ${DECOY_IDS.length} neo nhiễu (B–F), nhận ${decoys.length}`);
  }
  const anchors: PieceSource['anchors'] = [{ id: 'A', x, y }];
  decoys.forEach(([dx, dy], i) => {
    if (!onGrid(dx) || !onGrid(dy)) {
      throw new Error(`piece ${id}: neo nhiễu (${dx}, ${dy}) không phải bội của ${ANCHOR_STEP}`);
    }
    anchors.push({ id: DECOY_IDS[i], x: x + dx, y: y + dy });
  });
  return { id, shapeKind: kind, orientation, frameSize: size, anchors };
}

function mirrored(p: PieceSource, newId: string, axis: 'x' | 'y', line: number): PieceSource {
  const anchors = p.anchors.map((a) => {
    const x = axis === 'x' ? 2 * line - a.x - p.frameSize : a.x;
    const y = axis === 'y' ? 2 * line - a.y - p.frameSize : a.y;
    if (!onGrid(x) || !onGrid(y)) {
      throw new Error(
        `mirror${axis.toUpperCase()} ${newId}: trục ${axis} = ${line} đưa neo ${a.id} tới (${x}, ${y}), không phải bội của ${ANCHOR_STEP}`
      );
    }
    return { id: a.id, x, y };
  });
  return {
    id: newId,
    shapeKind: p.shapeKind,
    orientation: mirrorOrientation(p.shapeKind, p.orientation, axis),
    frameSize: p.frameSize,
    anchors,
  };
}

/** Bản đối xứng trái–phải qua đường thẳng đứng x = axisX; neo nhiễu lật theo. */
export function mirrorX(p: PieceSource, axisX: number, newId: string): PieceSource {
  return mirrored(p, newId, 'x', axisX);
}

/** Bản đối xứng trên–dưới qua đường nằm ngang y = axisY; neo nhiễu lật theo. */
export function mirrorY(p: PieceSource, axisY: number, newId: string): PieceSource {
  return mirrored(p, newId, 'y', axisY);
}

/** Nhiều mảnh chung một tâm khung. */
export function concentric(
  center: readonly [number, number],
  specs: readonly PieceSpec[],
  opts?: { placement?: PlacementMode }
): PieceSource[] {
  return specs.map((s) =>
    piece(s.id, s.kind, s.size, center, {
      orientation: s.orientation,
      decoys: s.decoys,
      placement: opts?.placement,
    })
  );
}

/** Lặp một mảnh theo bước [dx, dy]; id là <idPrefix>1..count. */
export function row(
  idPrefix: string,
  kind: ShapeKind,
  size: number,
  startCenter: readonly [number, number],
  step: readonly [number, number],
  count: number,
  opts: PieceOptions = {}
): PieceSource[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`row ${idPrefix}: count phải là số nguyên ≥ 1, nhận ${count}`);
  }
  return Array.from({ length: count }, (_, i) =>
    piece(
      `${idPrefix}${i + 1}`,
      kind,
      size,
      [startCenter[0] + i * step[0], startCenter[1] + i * step[1]],
      opts
    )
  );
}
