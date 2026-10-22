/**
 * Bộ sinh màn vô tận Chương 2: Giao Thoa (Endless Chapter 2 Generator).
 *
 * Ràng buộc thiết kế:
 *   1. Thẩm mỹ Cổ Ngữ Tiên Tri HSR (Divination Slate): hình khối đối xứng, trang trọng, không dị dạng.
 *   2. Độ sâu chồng tối đa 3 tầng (StackDepth <= 3).
 *   3. Chỉ có 1 đến 2 vùng 3 tầng (hạt nhân tái hiện / điểm nhấn bừng sáng).
 *   4. Bắt buộc có vùng giao thoa triệt tiêu (2 tầng rỗng).
 *   5. Mỗi mảnh có 2–3 neo nhiễu "suýt đúng" (false-fit decoys).
 *   6. Chứng minh đúng 1 nghiệm duy nhất qua solveLevel và authorLevel.
 */
import type { Orientation, ShapeKind } from '../../../src/domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../../../src/domain/model.ts';
import { isValidFrame, shapeCells } from '../../../src/domain/shapes.ts';
import { anchorFitsBoard, buildLevelDocument } from '../../../src/content/authoring.ts';
import type { LevelSource, PieceSource } from '../../../src/content/authoring.ts';
import { authorLevel } from '../../../src/content/authorLevel.ts';
import type { AuthorResult } from '../../../src/content/authorLevel.ts';
import { solveLevel } from '../../../src/content/solver.ts';

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PlacedPiece = {
  kind: ShapeKind;
  orientation: Orientation;
  frameSize: number;
  x: number;
  y: number;
  cells: ReadonlyArray<readonly [number, number]>;
};

export type ArchetypeId =
  | 'oracle-butterfly'
  | 'vanguard-chevron'
  | 'prophetic-eye'
  | 'concentric-dial'
  | 'crystal-shield';

const STEP = 8;
const MARGIN = 8;
const DECOY_NAMES = ['B', 'C', 'D', 'E'] as const;
const MIN_DECOYS = 2;
const MAX_DECOYS = 3;

/** Tạo mảnh hợp lệ với các ô đã rasterize sẵn */
function makePiece(kind: ShapeKind, orientation: Orientation, frameSize: number, x: number, y: number): PlacedPiece | null {
  if (!isValidFrame(kind, orientation, frameSize)) return null;
  if (x < MARGIN || y < MARGIN || x + frameSize > GRID_WIDTH - MARGIN || y + frameSize > GRID_HEIGHT - MARGIN) {
    return null;
  }
  return {
    kind,
    orientation,
    frameSize,
    x,
    y,
    cells: shapeCells(kind, orientation, frameSize),
  };
}

/** 1. Archetype Cánh Bướm Điệp Ảnh (Oracle Butterfly / Bow) */
function buildButterfly(rng: Rng): PlacedPiece[] | null {
  const pieces: PlacedPiece[] = [];
  const wingSizes = [64, 80, 96] as const;
  const W = wingSizes[Math.floor(rng() * wingSizes.length)];
  const overlaps = [16, 32, 48] as const;
  const delta = overlaps[Math.floor(rng() * overlaps.length)];

  const xLeft = 64 + delta / 2 - W / 2;
  const xRight = 64 - delta / 2 - W / 2;
  const yWing = 80 - W / 2;

  const left = makePiece('triangle', 5, W, xLeft, yWing);
  const right = makePiece('triangle', 7, W, xRight, yWing);
  if (!left || !right) return null;
  pieces.push(left, right);

  // Thêm ngọc hạt nhân ở tâm rỗng (tầng 3)
  const jewelSizes = [16, 24, 32] as const;
  const K = jewelSizes[Math.floor(rng() * jewelSizes.length)];
  const jewelKind: ShapeKind = rng() < 0.6 ? 'diamond' : 'square';
  const jewel = makePiece(jewelKind, 0, K, 64 - K / 2, 80 - K / 2);
  if (jewel) pieces.push(jewel);

  // Có thể thêm 1 đỉnh vương miện trên hoặc dưới
  if (rng() < 0.7) {
    const crestSize = 32;
    const isTop = rng() < 0.5;
    const yCrest = isTop ? yWing - 16 : yWing + W - 16;
    const crest = makePiece('diamond', 0, crestSize, 64 - crestSize / 2, yCrest);
    if (crest) pieces.push(crest);
  }

  return pieces;
}

/** 2. Archetype Mũi Tên Tiên Phong (Vanguard Chevron) */
function buildChevron(rng: Rng): PlacedPiece[] | null {
  const pieces: PlacedPiece[] = [];
  const W1 = rng() < 0.5 ? 96 : 80;
  const y1 = 40;
  const outer = makePiece('triangle', 4, W1, 64 - W1 / 2, y1);
  if (!outer) return null;
  pieces.push(outer);

  const W2 = rng() < 0.5 ? 48 : 64;
  const shiftY = 32 + Math.floor(rng() * 3) * 8; // 32, 40, 48
  const inner = makePiece('triangle', 4, W2, 64 - W2 / 2, y1 + shiftY);
  if (!inner) return null;
  pieces.push(inner);

  // Thêm 1 ngọc ở đỉnh hoặc ở lòng mũi tên
  const K = 24;
  const gem = makePiece('diamond', 0, K, 64 - K / 2, y1 + shiftY - 8);
  if (gem) pieces.push(gem);

  // Thêm 2 cánh phụ đối xứng hai bên
  if (rng() < 0.6) {
    const finSize = 32;
    const finLeft = makePiece('triangle', 1, finSize, 64 - W1 / 2, y1 + W1 - finSize);
    const finRight = makePiece('triangle', 0, finSize, 64 + W1 / 2 - finSize, y1 + W1 - finSize);
    if (finLeft && finRight) pieces.push(finLeft, finRight);
  }

  return pieces;
}

/** 3. Archetype Mắt Tiên Tri (Prophetic Eye) */
function buildPropheticEye(rng: Rng): PlacedPiece[] | null {
  const pieces: PlacedPiece[] = [];
  const S = rng() < 0.5 ? 64 : 80;
  const delta = 32;
  const d1 = makePiece('diamond', 0, S, 64 - S / 2 - delta / 2, 80 - S / 2);
  const d2 = makePiece('diamond', 0, S, 64 - S / 2 + delta / 2, 80 - S / 2);
  if (!d1 || !d2) return null;
  pieces.push(d1, d2);

  // Con ngươi ở tâm (tầng 3)
  const pupilSize = 16;
  const pupil = makePiece('diamond', 0, pupilSize, 64 - pupilSize / 2, 80 - pupilSize / 2);
  if (pupil) pieces.push(pupil);

  // Đôi ngọc giọt nước phụ hai bên khoé mắt
  if (rng() < 0.7) {
    const flankSize = 24;
    const flankY = 80 - flankSize / 2;
    const leftFlank = makePiece('diamond', 0, flankSize, 64 - S / 2 - delta / 2 - 8, flankY);
    const rightFlank = makePiece('diamond', 0, flankSize, 64 + S / 2 + delta / 2 - flankSize + 8, flankY);
    if (leftFlank && rightFlank) pieces.push(leftFlank, rightFlank);
  }

  return pieces;
}

/** 4. Archetype Vòng Chiêm Tinh Đồng Tâm (Concentric Cosmic Dial) */
function buildConcentricDial(rng: Rng): PlacedPiece[] | null {
  const pieces: PlacedPiece[] = [];
  const S1 = rng() < 0.6 ? 80 : 96;
  const S2 = rng() < 0.6 ? 48 : 64;

  const outerKind: ShapeKind = rng() < 0.5 ? 'circle' : 'diamond';
  const outer = makePiece(outerKind, 0, S1, 64 - S1 / 2, 80 - S1 / 2);
  const inner = makePiece(outerKind, 0, S2, 64 - S2 / 2, 80 - S2 / 2);
  if (!outer || !inner) return null;
  pieces.push(outer, inner);

  // Lõi đồng hồ cát hoặc ngọc tâm
  if (rng() < 0.6) {
    const H = 32;
    const tTop = makePiece('triangle', 6, H, 64 - H / 2, 80 - H / 2);
    const tBottom = makePiece('triangle', 4, H, 64 - H / 2, 80 - H / 2);
    if (tTop && tBottom) pieces.push(tTop, tBottom);
  } else {
    const gemSize = 24;
    const gem = makePiece('diamond', 0, gemSize, 64 - gemSize / 2, 80 - gemSize / 2);
    if (gem) pieces.push(gem);
  }

  return pieces;
}

/** 5. Archetype Khiên Tinh Thể (Crystal Shield / Emblem) */
function buildCrystalShield(rng: Rng): PlacedPiece[] | null {
  const pieces: PlacedPiece[] = [];
  const baseSize = 64;
  const base = makePiece('square', 0, baseSize, 64 - baseSize / 2, 80 - baseSize / 2);
  const core = makePiece('diamond', 0, baseSize, 64 - baseSize / 2, 80 - baseSize / 2);
  if (!base || !core) return null;
  pieces.push(base, core);

  // Ngọc tâm 3 tầng
  const gemSize = 32;
  const gem = makePiece('diamond', 0, gemSize, 64 - gemSize / 2, 80 - gemSize / 2);
  if (gem) pieces.push(gem);

  // Đỉnh vương miện tam giác
  if (rng() < 0.7) {
    const crest = makePiece('triangle', 6, 32, 64 - 16, 80 - baseSize / 2 - 16);
    if (crest) pieces.push(crest);
  }

  return pieces;
}

/** Đếm số vùng độc lập và tổng diện tích của tầng 3 */
function analyze3LayerSpots(coverage: Uint8Array): { count: number; totalArea: number } {
  const visited = new Uint8Array(coverage.length);
  let count = 0;
  let totalArea = 0;

  for (let i = 0; i < coverage.length; i++) {
    if (coverage[i] === 3 && !visited[i]) {
      count++;
      const queue = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const curr = queue.pop()!;
        totalArea++;
        const cx = curr % GRID_WIDTH;
        const cy = Math.floor(curr / GRID_WIDTH);
        const neighbors = [
          cx > 0 ? curr - 1 : -1,
          cx < GRID_WIDTH - 1 ? curr + 1 : -1,
          cy > 0 ? curr - GRID_WIDTH : -1,
          cy < GRID_HEIGHT - 1 ? curr + GRID_WIDTH : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && coverage[n] === 3 && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  }

  return { count, totalArea };
}

/** Kiểm tra tính đối xứng gương qua trục x = 64 */
function isSymmetricX(mask: Uint8Array): boolean {
  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = y * GRID_WIDTH;
    for (let x = 0; x < 64; x++) {
      if (mask[row + x] !== mask[row + (127 - x)]) {
        return false;
      }
    }
  }
  return true;
}

/** Kiểm tra và lọc bố cục theo luật Chương 2 & thẩm mỹ HSR */
function validateComposition(pieces: PlacedPiece[]): { ok: boolean; targetMask: Uint8Array } {
  if (pieces.length < 3 || pieces.length > 5) return { ok: false, targetMask: new Uint8Array(0) };

  const coverage = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  for (const p of pieces) {
    for (const [cx, cy] of p.cells) {
      const idx = (p.y + cy) * GRID_WIDTH + (p.x + cx);
      coverage[idx]++;
    }
  }

  // 1. Tối đa 3 tầng (cấm >= 4)
  for (let i = 0; i < coverage.length; i++) {
    if (coverage[i] > 3) return { ok: false, targetMask: coverage };
  }

  // 2. Bắt buộc có vùng giao thoa (tầng 2)
  let overlapCount = 0;
  for (let i = 0; i < coverage.length; i++) {
    if (coverage[i] >= 2) overlapCount++;
  }
  if (overlapCount < 32) return { ok: false, targetMask: coverage };

  // 3. Tối đa 1 đến 2 vùng 3 tầng
  const spots3 = analyze3LayerSpots(coverage);
  if (spots3.count > 2) return { ok: false, targetMask: coverage };
  if (spots3.totalArea > 350) return { ok: false, targetMask: coverage };

  // 4. Target silhouette mask (XOR parity)
  const targetMask = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  let activeCells = 0;
  for (let i = 0; i < coverage.length; i++) {
    if (coverage[i] % 2 === 1) {
      targetMask[i] = 1;
      activeCells++;
    }
  }

  if (activeCells < 200 || activeCells > 4000) return { ok: false, targetMask };

  // 5. Đối xứng được đảm bảo bởi cấu trúc của Archetype
  return { ok: true, targetMask };
}

export type GeneratedStats = {
  archetype: ArchetypeId;
  pieces: number;
  decoys: number;
  minDecoysPerPiece: number;
  threeLayerSpots: number;
  difficultyEstimate: number;
};

export type Generated = {
  source: LevelSource;
  result: Extract<AuthorResult, { ok: true }>;
  stats: GeneratedStats;
  silhouetteKey: string;
};

function pieceLetter(p: PlacedPiece): string {
  if (p.kind === 'square') return 'S';
  if (p.kind === 'diamond') return 'D';
  if (p.kind === 'circle') return 'C';
  if (p.kind === 'triangle') return p.orientation < 4 ? 'T' : 'R';
  return 'P';
}

/** Băm silhouette chuẩn hoá để loại trùng */
function silhouetteKeyOf(doc: { targetCells: ReadonlyArray<readonly [number, number]> }): string {
  const xs = doc.targetCells.map((c) => c[0]);
  const ys = doc.targetCells.map((c) => c[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const hash = (flip: boolean): string => {
    const set = doc.targetCells
      .map(([x, y]) => (flip ? x1 - x : x - x0) * 1000 + (y - y0))
      .sort((a, b) => a - b);
    let h = 2166136261;
    for (const v of set) h = Math.imul(h ^ v, 16777619) >>> 0;
    return `${set.length}:${h.toString(16)}`;
  };
  const a = hash(false);
  const b = hash(true);
  return a < b ? a : b;
}

/** Thử sinh 1 màn Chương 2 từ seed theo một trong các Archetype */
export function generateChapter2Level(seed: number, id: string, order: number): Generated | null {
  const rng = mulberry32(seed);

  const archetypes: ArchetypeId[] = [
    'oracle-butterfly',
    'vanguard-chevron',
    'prophetic-eye',
    'concentric-dial',
    'crystal-shield',
  ];
  const archetype = archetypes[Math.floor(rng() * archetypes.length)];

  let placed: PlacedPiece[] | null = null;
  switch (archetype) {
    case 'oracle-butterfly':
      placed = buildButterfly(rng);
      break;
    case 'vanguard-chevron':
      placed = buildChevron(rng);
      break;
    case 'prophetic-eye':
      placed = buildPropheticEye(rng);
      break;
    case 'concentric-dial':
      placed = buildConcentricDial(rng);
      break;
    case 'crystal-shield':
      placed = buildCrystalShield(rng);
      break;
  }

  if (!placed) return null;

  const comp = validateComposition(placed);
  if (!comp.ok) return null;

  const targetMask = comp.targetMask;
  const counters = new Map<string, number>();

  // Thu thập các vị trí nghiệm theo nhóm hình học giống hệt nhau
  const groupPositions = new Map<string, Array<{ x: number; y: number }>>();
  for (const p of placed) {
    const key = `${p.kind}:${p.orientation}:${p.frameSize}`;
    if (!groupPositions.has(key)) groupPositions.set(key, []);
    groupPositions.get(key)!.push({ x: p.x, y: p.y });
  }

  const pieces: PieceSource[] = placed.map((p) => {
    const letter = pieceLetter(p);
    const num = (counters.get(letter) ?? 0) + 1;
    counters.set(letter, num);
    const key = `${p.kind}:${p.orientation}:${p.frameSize}`;
    const allPos = groupPositions.get(key)!;

    // Neo chính A là vị trí của chính nó
    const anchors: Array<{ id: string; x: number; y: number }> = [{ id: 'A', x: p.x, y: p.y }];
    // Các neo hoán vị nghiệm tương đương (A2, A3...) để người chơi kéo mảnh giống hệt vào vị trí đối xứng đều hít được
    let altIdx = 2;
    for (const pos of allPos) {
      if (pos.x !== p.x || pos.y !== p.y) {
        anchors.push({ id: `A${altIdx++}`, x: pos.x, y: pos.y });
      }
    }

    return {
      id: `${letter}${num}`,
      shapeKind: p.kind,
      orientation: p.orientation,
      frameSize: p.frameSize,
      anchors,
    };
  });

  // Sinh sampleSolutions: bao gồm nghiệm chuẩn A và các hoán vị tương đương
  // để filterDecoys giữ lại các neo hoán vị A2, A3... cho người chơi đặt tự nhiên
  const sampleSolutions: Array<Array<{ pieceId: string; anchorId: string; turns: 0 }>> = [
    pieces.map((p) => ({ pieceId: p.id, anchorId: 'A', turns: 0 as const })),
  ];

  for (const [key, allPos] of groupPositions.entries()) {
    if (allPos.length === 2) {
      const groupPieces = pieces.filter((p) => `${p.shapeKind}:${p.orientation}:${p.frameSize}` === key);
      if (groupPieces.length === 2) {
        const swapped = pieces.map((p) => {
          if (p.id === groupPieces[0].id || p.id === groupPieces[1].id) {
            return { pieceId: p.id, anchorId: 'A2', turns: 0 as const };
          }
          return { pieceId: p.id, anchorId: 'A', turns: 0 as const };
        });
        sampleSolutions.push(swapped);
      }
    }
  }

  const baseSource: LevelSource = {
    id,
    title: `Cổ Ngữ ${order}`,
    chapter: 2,
    order,
    contentRevision: 'endless-ch2-v1',
    rotationEnabled: false,
    pieces,
    sampleSolutions,
    learningObjective: 'Endless Chương 2: Giao thoa triệt tiêu đối xứng',
    difficultyEstimate: 3,
    distractors: [],
    ftueSteps: [],
  };

  // Bước 1: Kiểm tra xem nghiệm cơ sở đã giải được chưa
  const baseDoc = buildLevelDocument(baseSource);
  const baseSolved = solveLevel(baseDoc);
  if (!baseSolved.proven || baseSolved.solutionCount !== 1 || baseSolved.fewerPieceSolutions !== 0) {
    return null;
  }

  // Bước 2: Sinh các neo nhiễu "suýt đúng" và kiểm chứng 1 nghiệm duy nhất
  const decoyOffsets = [
    [-8, 0], [8, 0], [0, -8], [0, 8],
    [-16, 0], [16, 0], [0, -16], [0, 16],
    [-8, -8], [8, -8], [-8, 8], [8, 8],
    [-24, 0], [24, 0], [0, -24], [0, 24],
  ] as const;

  const decoyCount = new Map<string, number>();

  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const p = placed[i];

    // Xếp hạng các vị trí neo nhiễu tiềm năng theo độ "ăn khớp một phần" với bóng
    const candidates = decoyOffsets
      .map(([dx, dy]) => {
        const x = p.x + dx;
        const y = p.y + dy;
        let overlapWithTarget = 0;
        for (const [cx, cy] of p.cells) {
          const ax = x + cx;
          const ay = y + cy;
          if (ax >= 0 && ay >= 0 && ax < GRID_WIDTH && ay < GRID_HEIGHT && targetMask[ay * GRID_WIDTH + ax]) {
            overlapWithTarget++;
          }
        }
        return {
          x,
          y,
          score: overlapWithTarget / p.cells.length + rng() * 0.25,
        };
      })
      .filter((c) => anchorFitsBoard(piece, c, false))
      .sort((a, b) => b.score - a.score);

    let tried = 0;
    for (const cand of candidates) {
      if ((decoyCount.get(piece.id) ?? 0) >= MAX_DECOYS || tried >= 12) break;
      tried++;

      const nextAnchorId = DECOY_NAMES[decoyCount.get(piece.id) ?? 0];
      piece.anchors.push({ id: nextAnchorId, x: cand.x, y: cand.y });

      const testDoc = buildLevelDocument(baseSource);
      const testSolved = solveLevel(testDoc);

      // Neo nhiễu CHỈ ĐƯỢC GIỮ khi solver vẫn chứng minh đúng 1 nghiệm duy nhất!
      if (testSolved.proven && testSolved.solutionCount === 1 && testSolved.fewerPieceSolutions === 0) {
        decoyCount.set(piece.id, (decoyCount.get(piece.id) ?? 0) + 1);
      } else {
        piece.anchors.pop();
      }
    }
  }

  const counts = pieces.map((p) => decoyCount.get(p.id) ?? 0);
  if (Math.min(...counts) < MIN_DECOYS) return null;

  // Bước 3: Cổng kiểm tra cuối cùng qua authorLevel
  const authorRes = authorLevel(baseSource);
  if (!authorRes.ok) return null;
  const report = authorRes.report;
  if (!report.proven || report.solutionCount !== 1 || report.fewerPieceSolutions !== 0) {
    return null;
  }

  const coverage = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  for (const p of placed) {
    for (const [cx, cy] of p.cells) {
      coverage[(p.y + cy) * GRID_WIDTH + (p.x + cx)]++;
    }
  }
  const spots3 = analyze3LayerSpots(coverage);

  return {
    source: baseSource,
    result: authorRes,
    stats: {
      archetype,
      pieces: pieces.length,
      decoys: counts.reduce((a, b) => a + b, 0),
      minDecoysPerPiece: Math.min(...counts),
      threeLayerSpots: spots3.count,
      difficultyEstimate: authorRes.score.score,
    },
    silhouetteKey: silhouetteKeyOf(authorRes.doc),
  };
}
