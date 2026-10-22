/**
 * Sinh ảnh minh hoạ bảng hình cho docs/content/level-kit.md.
 *
 *   npm run content:gallery
 *
 * Mỗi hình, mỗi hướng: một mảnh khung 48 đặt giữa bàn, vẽ bằng renderPreviewSvg.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLevelDocument } from '../../src/content/authoring.ts';
import type { LevelSource } from '../../src/content/authoring.ts';
import { renderPreviewSvg } from '../../src/content/authoringReport.ts';
import { piece } from '../../src/content/kit.ts';
import type { Orientation, ShapeKind } from '../../src/domain/model.ts';

export const GALLERY: ReadonlyArray<{ kind: ShapeKind; orientations: readonly Orientation[] }> = [
  { kind: 'square', orientations: [0] },
  { kind: 'triangle', orientations: [0, 1, 2, 3, 4, 5, 6, 7] },
  { kind: 'diamond', orientations: [0] },
  { kind: 'circle', orientations: [0] },
  { kind: 'parallelogram', orientations: [0, 1, 2, 3] },
];

export function galleryFileName(kind: ShapeKind, orientation: Orientation): string {
  return `${kind}-${orientation}.svg`;
}

function gallerySource(kind: ShapeKind, orientation: Orientation): LevelSource {
  return {
    id: `kit-${kind}-${orientation}`,
    title: `${kind} hướng ${orientation}`,
    chapter: 1,
    order: 1,
    contentRevision: 'kit-gallery',
    rotationEnabled: false,
    pieces: [piece('P1', kind, 48, [64, 80], { orientation })],
    sampleSolutions: [[{ pieceId: 'P1', anchorId: 'A', turns: 0 }]],
    learningObjective: 'Minh hoạ bảng hình',
    difficultyEstimate: 1,
    distractors: [],
    ftueSteps: [],
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (isMainModule()) {
  const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/content/kit');
  mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const g of GALLERY) {
    for (const o of g.orientations) {
      const svg = renderPreviewSvg(buildLevelDocument(gallerySource(g.kind, o)));
      writeFileSync(resolve(outDir, galleryFileName(g.kind, o)), svg, 'utf8');
      count++;
    }
  }
  console.log(`[kit-gallery] Đã ghi ${count} ảnh vào docs/content/kit/`);
}
