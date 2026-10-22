import { describe, expect, test, vi } from 'vitest';
import type Phaser from 'phaser';
import { loadLevel } from '../src/content/catalog.ts';
import type { Level } from '../src/domain/model.ts';
import {
  PieceTextureCache,
  TEXTURE_BUDGET_BYTES,
  bodyTextureSize,
  chooseResolution,
  levelTextureBytes,
  pieceTurnBytes,
} from '../src/presentation/board/PieceTextureCache.ts';
import { createFakeScene } from './helpers/fakeScene.ts';

vi.mock('phaser', () => ({
  default: {
    Display: {
      Color: {
        HexStringToColor: (value: string) => ({ color: Number.parseInt(value.slice(1), 16) }),
      },
    },
    Geom: {
      Point: class {
        x: number;
        y: number;
        constructor(x: number, y: number) {
          this.x = x;
          this.y = y;
        }
      },
    },
  },
}));

const MiB = 1024 * 1024;

describe('kích thước và bộ nhớ texture', () => {
  test('khung 48 ô ở 5 px: body 360 px, một (mảnh × hướng) 777 600 B', () => {
    expect(bodyTextureSize(48, 5, 1)).toBe(360);
    expect(pieceTurnBytes(48, 5, 1)).toBe(360 * 360 * 4 + 2 * 180 * 180 * 4);
  });

  test.each(['1-1', '1-2', '1-3', '1-4', '1-5', '1-6'])('%s dưới ngưỡng 24 MiB ở độ phân giải 1', (id) => {
    const level = loadLevel(id, 'harness');
    const bytes = levelTextureBytes(level, 5, 1);
    const expectedBytes = level.pieces.reduce((sum, p) => sum + pieceTurnBytes(p.frameSize, 5, 1), 0);
    expect(bytes).toBe(expectedBytes);
    expect(bytes).toBeLessThan(TEXTURE_BUDGET_BYTES);
    expect(chooseResolution(level, 5)).toBe(1);
  });

  test('màn giả định 6 mảnh khung 64 xoay được: hạ về 0,75 và vừa ngân sách', () => {
    const base = loadLevel('1-1', 'harness');
    const heavy: Level = {
      ...base,
      rotationEnabled: true,
      pieces: Array.from({ length: 6 }, (_, i) => ({ ...base.pieces[0], id: `H${i}`, frameSize: 64 })),
    };
    expect(levelTextureBytes(heavy, 5, 1) / MiB).toBeGreaterThan(24);
    expect(chooseResolution(heavy, 5)).toBe(0.75);
    expect(levelTextureBytes(heavy, 5, 0.75)).toBeLessThanOrEqual(TEXTURE_BUDGET_BYTES);
  });
});

describe('PieceTextureCache vẽ rải', () => {
  test('mỗi bakeNext vẽ đúng một (mảnh × hướng); keys có sau khi vẽ', () => {
    const { scene, calls } = createFakeScene();
    const level = loadLevel('1-1', 'harness');
    const cache = new PieceTextureCache(scene as unknown as Phaser.Scene, level, 5);
    cache.enqueue(level.pieces[0].id, 0);
    cache.enqueue(level.pieces[1].id, 0);
    cache.enqueue(level.pieces[1].id, 1);
    expect(cache.keys(level.pieces[0].id, 0)).toBeNull();
    expect(cache.bakeNext()).toBe(true);
    expect(cache.keys(level.pieces[0].id, 0)).not.toBeNull();
    expect(cache.keys(level.pieces[1].id, 0)).toBeNull();
    expect(calls.filter((c) => c.method === 'generateTexture')).toHaveLength(3); // body, shadow, light
    cache.bakeNext();
    cache.bakeNext();
    expect(cache.bakeNext()).toBe(false);
    expect(cache.bytesBaked()).toBe(3 * 777_600);
  });

  test('ensure vẽ đồng bộ hướng chưa có và không vẽ lại lần hai', () => {
    const { scene, calls } = createFakeScene();
    const level = loadLevel('1-1', 'harness');
    const cache = new PieceTextureCache(scene as unknown as Phaser.Scene, level, 5);
    const keys = cache.ensure(level.pieces[0].id, 2);
    expect(keys.body).toBe(`piece:1-1:${level.pieces[0].id}:2:body`);
    cache.ensure(level.pieces[0].id, 2);
    expect(calls.filter((c) => c.method === 'generateTexture')).toHaveLength(3);
  });
});
