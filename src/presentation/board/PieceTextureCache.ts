import type Phaser from 'phaser';
import type { Level, Piece } from '../../domain/model.ts';
import { drawJewelPolygon } from './JewelShape.ts';
import { piecePolygonAround } from './layout.ts';

/** Lề mỗi phía so với cạnh khung: hào quang tam giác tràn ~0.165 cạnh */
export const TEXTURE_PAD_RATIO = 0.25;
/** Bóng đổ và chớp sáng vẽ ở nửa độ phân giải: chúng vốn mềm */
export const SILHOUETTE_SCALE = 0.5;
/** Ngưỡng F3 P-06 */
export const TEXTURE_BUDGET_BYTES = 24 * 1024 * 1024;

export type PieceTextureKeys = { body: string; shadow: string; light: string; resolution: number };

export interface PieceTextureSource {
  keys(pieceId: string, turns: number): PieceTextureKeys | null;
  ensure(pieceId: string, turns: number): PieceTextureKeys;
}

export function bodyTextureSize(frameSize: number, cellPixel: number, resolution: number): number {
  return Math.ceil(frameSize * cellPixel * (1 + 2 * TEXTURE_PAD_RATIO) * resolution);
}

function silhouetteSize(body: number): number {
  return Math.ceil(body * SILHOUETTE_SCALE);
}

export function pieceTurnBytes(frameSize: number, cellPixel: number, resolution: number): number {
  const body = bodyTextureSize(frameSize, cellPixel, resolution);
  const sil = silhouetteSize(body);
  return 4 * (body * body + 2 * sil * sil);
}

/** Ước tính xấu nhất của màn: xoay được thì đủ 4 hướng mỗi mảnh */
export function levelTextureBytes(level: Level, cellPixel: number, resolution: number): number {
  const turns = level.rotationEnabled ? 4 : 1;
  return level.pieces.reduce((sum, p) => sum + turns * pieceTurnBytes(p.frameSize, cellPixel, resolution), 0);
}

export function chooseResolution(level: Level, cellPixel: number): 1 | 0.75 {
  return levelTextureBytes(level, cellPixel, 1) <= TEXTURE_BUDGET_BYTES ? 1 : 0.75;
}

/**
 * Vẽ mỗi (mảnh × hướng) một lần thành ba texture: thân ngọc, bóng đen, chớp
 * trắng. `bakeNext` vẽ một mảnh mỗi khung để không có khung nào quá 50 ms
 * (F3 P-04); `ensure` vẽ đồng bộ khi cần ngay (xoay tới hướng mới).
 */
export class PieceTextureCache implements PieceTextureSource {
  private readonly scene: Phaser.Scene;
  private readonly level: Level;
  private readonly cellPixel: number;
  private readonly resolution: 1 | 0.75;
  private readonly baked = new Map<string, PieceTextureKeys>();
  private readonly queue: Array<{ pieceId: string; turns: number }> = [];
  private bytes = 0;

  constructor(scene: Phaser.Scene, level: Level, cellPixel: number) {
    this.scene = scene;
    this.level = level;
    this.cellPixel = cellPixel;
    this.resolution = chooseResolution(level, cellPixel);
  }

  enqueue(pieceId: string, turns: number): void {
    const t = ((turns % 4) + 4) % 4;
    if (this.baked.has(this.id(pieceId, t))) return;
    if (this.queue.some((q) => q.pieceId === pieceId && q.turns === t)) return;
    this.queue.push({ pieceId, turns: t });
  }

  bakeNext(): boolean {
    const next = this.queue.shift();
    if (!next) return false;
    this.ensure(next.pieceId, next.turns);
    return true;
  }

  keys(pieceId: string, turns: number): PieceTextureKeys | null {
    return this.baked.get(this.id(pieceId, turns)) ?? null;
  }

  ensure(pieceId: string, turns: number): PieceTextureKeys {
    const existing = this.keys(pieceId, turns);
    if (existing) return existing;
    const piece = this.level.pieces.find((p) => p.id === pieceId);
    if (!piece) throw new Error(`unknown-piece:${pieceId}`);
    const keys = this.bake(piece, turns);
    this.baked.set(this.id(pieceId, turns), keys);
    return keys;
  }

  bytesBaked(): number {
    return this.bytes;
  }

  destroy(): void {
    for (const keys of this.baked.values()) {
      for (const key of [keys.body, keys.shadow, keys.light]) {
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      }
    }
    this.baked.clear();
    this.queue.length = 0;
    this.bytes = 0;
  }

  private id(pieceId: string, turns: number): string {
    return `${pieceId}:${turns}`;
  }

  private bake(piece: Piece, turns: number): PieceTextureKeys {
    const prefix = `piece:${this.level.id}:${piece.id}:${turns}`;
    const keys: PieceTextureKeys = {
      body: `${prefix}:body`,
      shadow: `${prefix}:shadow`,
      light: `${prefix}:light`,
      resolution: this.resolution,
    };
    const framePx = piece.frameSize * this.cellPixel * this.resolution;
    const size = bodyTextureSize(piece.frameSize, this.cellPixel, this.resolution);
    const sil = silhouetteSize(size);
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

    drawJewelPolygon(g, piecePolygonAround(piece, turns, size / 2, size / 2, framePx), {
      variant: 'solid',
      sizePx: framePx / 2,
    });
    g.generateTexture(keys.body, size, size);

    const outline = piecePolygonAround(piece, turns, sil / 2, sil / 2, framePx * SILHOUETTE_SCALE);
    for (const [key, color] of [[keys.shadow, 0x000000], [keys.light, 0xffffff]] as const) {
      g.clear();
      g.fillStyle(color, 1);
      g.fillPoints(outline, true);
      g.generateTexture(key, sil, sil);
    }
    g.destroy();
    this.bytes += pieceTurnBytes(piece.frameSize, this.cellPixel, this.resolution);
    return keys;
  }
}
