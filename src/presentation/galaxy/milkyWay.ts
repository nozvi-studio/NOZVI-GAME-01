import { COLOR_TOKENS } from '../designTokens.ts';
import { mulberry32 } from '../sky/starField.ts';

export type CloudBlob = { x: number; y: number; r: number; hex: string; alpha: number };

/** Dải chạy từ trái-dưới lên phải-trên, như ảnh ref. */
const BAND_ANGLE = (-52 * Math.PI) / 180;
export const MILKY_WAY_SEED = 7;

const { cloud } = COLOR_TOKENS.sky;

/** Từ lớp ngoài rộng, mờ, đến lõi hẹp, sáng. Tinh chỉnh `alpha` bằng mắt theo ảnh ref. */
const LAYERS = [
  { hex: cloud.base, count: 22, halfWidth: 300, rMin: 150, rMax: 260, alpha: 0.28 },
  { hex: cloud.mid, count: 18, halfWidth: 200, rMin: 110, rMax: 190, alpha: 0.3 },
  { hex: cloud.violet, count: 14, halfWidth: 120, rMin: 80, rMax: 140, alpha: 0.34 },
  { hex: cloud.core, count: 10, halfWidth: 60, rMin: 50, rMax: 90, alpha: 0.3 },
  { hex: cloud.hot, count: 4, halfWidth: 24, rMin: 40, rMax: 70, alpha: 0.22 },
] as const;

export const CLOUD_BLOB_COUNT = LAYERS.reduce((sum, layer) => sum + layer.count, 0);

/**
 * Toạ độ các quầng mây trong khung `width` x `height`. Thuần và tái lập được.
 * Mỗi lớp rải dọc dải với độ lệch ngang uốn sóng, nên mép dải không thẳng.
 */
export function milkyWayBlobs(seed: number, width: number, height: number): CloudBlob[] {
  const rand = mulberry32(seed);
  const dx = Math.cos(BAND_ANGLE);
  const dy = Math.sin(BAND_ANGLE);
  const nx = -dy;
  const ny = dx;
  const length = Math.hypot(width, height);
  const blobs: CloudBlob[] = [];

  LAYERS.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      const t = (i + rand() * 0.8) / layer.count - 0.5;
      const wobble = Math.sin(t * 9 + li * 1.7) * layer.halfWidth * 0.35;
      const off = (rand() * 2 - 1) * layer.halfWidth * 0.6 + wobble;
      blobs.push({
        x: width / 2 + dx * t * length + nx * off,
        y: height / 2 + dy * t * length + ny * off,
        r: layer.rMin + rand() * (layer.rMax - layer.rMin),
        hex: layer.hex,
        alpha: layer.alpha,
      });
    }
  });
  return blobs;
}
