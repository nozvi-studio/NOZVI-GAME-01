import type { Cell, Chapter, Level, Orientation, Piece, Placement, PlacementMode, Turns } from '../domain/model.ts';
import { GRID_HEIGHT, GRID_WIDTH, TOTAL_CELLS } from '../domain/model.ts';
import { fitsBoard, turnedCells } from '../domain/geometry.ts';
import { evaluate, matchesTarget } from '../domain/mask.ts';
import { effectiveOrientation, isStructuralFrame, isValidOrientation, shapeCells } from '../domain/shapes.ts';
import { GRID_STEP } from '../domain/freePlacement.ts';
import type { LevelDocument, ValidationIssue, ValidationResult } from './document.ts';
import { NO_OVERLAP_CHAPTERS, ROTATION_CHAPTER, chapterInfo } from './chapters.ts';
import { pressPlan, turnPeriod } from '../domain/linkedRotation.ts';
import { parFromSolution } from '../domain/starRating.ts';

export function validateLevel(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (typeof input !== 'object' || input === null) {
    return {
      ok: false,
      issues: [{ levelId: 'unknown', field: 'root', code: 'invalid-json-root' }],
    };
  }

  const doc = input as Partial<LevelDocument>;
  const levelId = typeof doc.id === 'string' && doc.id.trim() ? doc.id : 'unknown';

  if (!doc.id || typeof doc.id !== 'string') {
    issues.push({ levelId, field: 'id', code: 'missing-id' });
  }
  if (!doc.title || typeof doc.title !== 'string') {
    issues.push({ levelId, field: 'title', code: 'missing-title' });
  }
  const chapterRule = chapterInfo(doc.chapter as number);
  if (!chapterRule) {
    issues.push({ levelId, field: 'chapter', code: 'invalid-chapter' });
  }
  if (typeof doc.order !== 'number' || !Number.isInteger(doc.order) || doc.order < 1) {
    issues.push({ levelId, field: 'order', code: 'invalid-order' });
  }
  if (typeof doc.rotationEnabled !== 'boolean') {
    issues.push({ levelId, field: 'rotationEnabled', code: 'invalid-rotation-flag' });
  }
  if (doc.victoryVerse !== undefined && typeof doc.victoryVerse !== 'string') {
    issues.push({ levelId, field: 'victoryVerse', code: 'invalid-victory-verse' });
  }

  // Xoay chỉ mở ở chương xoay (Chương 3 — Luân Chuyển): các chương khác cấm bật, chương 3 bắt buộc bật
  if (chapterRule && !chapterRule.rotationEnabled && doc.rotationEnabled === true) {
    issues.push({ levelId, field: 'rotationEnabled', code: 'chapter-rotation-disabled' });
  }
  if (chapterRule && chapterRule.rotationEnabled && doc.rotationEnabled === false) {
    issues.push({ levelId, field: 'rotationEnabled', code: 'chapter-rotation-required' });
  }

  // Chế độ đặt (FP-01): thiếu thì là 'anchors'
  const rawPlacement: unknown = doc.placement;
  const placement: PlacementMode = rawPlacement === 'free' ? 'free' : 'anchors';
  if (rawPlacement !== undefined && rawPlacement !== 'anchors' && rawPlacement !== 'free') {
    issues.push({ levelId, field: 'placement', code: 'invalid-placement' });
  }
  // Màn đặt tự do: mọi giao điểm lưới đã là neo nhiễu nên distractors phải rỗng (FP-02)
  if (placement === 'free' && Array.isArray(doc.distractors) && doc.distractors.length > 0) {
    issues.push({ levelId, field: 'distractors', code: 'free-placement-distractors' });
  }
  const allow: unknown = doc.allowUnproven;
  if (
    allow !== undefined &&
    (typeof allow !== 'object' ||
      allow === null ||
      typeof (allow as { reason?: unknown }).reason !== 'string' ||
      (allow as { reason: string }).reason.trim() === '')
  ) {
    issues.push({ levelId, field: 'allowUnproven', code: 'invalid-allow-unproven' });
  }

  // Pieces validation
  if (!Array.isArray(doc.pieces) || doc.pieces.length === 0) {
    issues.push({ levelId, field: 'pieces', code: 'empty-pieces' });
  }

  const pieceIds = new Set<string>();
  const parsedPieces: Piece[] = [];

  if (Array.isArray(doc.pieces)) {
    for (let pIdx = 0; pIdx < doc.pieces.length; pIdx++) {
      const p = doc.pieces[pIdx];
      const pField = `pieces[${pIdx}]`;

      if (!p || typeof p !== 'object') {
        issues.push({ levelId, field: pField, code: 'invalid-piece-object' });
        continue;
      }

      if (!p.id || typeof p.id !== 'string') {
        issues.push({ levelId, field: `${pField}.id`, code: 'missing-piece-id' });
      } else if (pieceIds.has(p.id)) {
        issues.push({ levelId, field: `${pField}.id`, code: 'duplicate-piece-id' });
      } else {
        pieceIds.add(p.id);
      }

      if (typeof p.frameSize !== 'number' || !Number.isInteger(p.frameSize) || p.frameSize <= 0) {
        issues.push({ levelId, field: `${pField}.frameSize`, code: 'invalid-frame-size' });
      }

      if (p.color !== 'amber') {
        issues.push({ levelId, field: `${pField}.color`, code: 'invalid-color' });
      }

      let cellsValid = false;
      if (!Array.isArray(p.cells) || p.cells.length === 0) {
        issues.push({ levelId, field: `${pField}.cells`, code: 'empty-cells' });
      } else {
        cellsValid = true;
        for (const cell of p.cells) {
          if (
            !Array.isArray(cell) ||
            cell.length !== 2 ||
            !Number.isInteger(cell[0]) ||
            !Number.isInteger(cell[1]) ||
            cell[0] < 0 ||
            cell[0] >= p.frameSize ||
            cell[1] < 0 ||
            cell[1] >= p.frameSize
          ) {
            issues.push({ levelId, field: `${pField}.cells`, code: 'invalid-cell-coordinate' });
            cellsValid = false;
            break;
          }
        }
      }

      // Hình và hướng: cells phải đúng bằng raster của đa giác chuẩn (LVL-02).
      // Tam giác và bình hành bắt buộc ghi hướng; vuông, thoi, tròn bỏ trống là 0.
      const needsOrientation = p.shapeKind === 'triangle' || p.shapeKind === 'parallelogram';
      const orientation = (
        p.orientation === undefined && !needsOrientation ? 0 : p.orientation
      ) as Orientation;
      const shapeKindValid =
        p.shapeKind === 'square' ||
        p.shapeKind === 'triangle' ||
        p.shapeKind === 'diamond' ||
        p.shapeKind === 'circle' ||
        p.shapeKind === 'parallelogram';
      if (!shapeKindValid) {
        issues.push({ levelId, field: `${pField}.shapeKind`, code: 'invalid-shape-kind' });
      } else if (
        (needsOrientation && p.orientation === undefined) ||
        !isValidOrientation(p.shapeKind, orientation)
      ) {
        issues.push({ levelId, field: `${pField}.orientation`, code: 'invalid-orientation' });
      } else if (
        typeof p.frameSize === 'number' &&
        !isStructuralFrame(p.shapeKind, orientation, p.frameSize)
      ) {
        // Luật bám lưới (spec A mục 3) kiểm ở authoring; validator chỉ chặn
        // khung làm đỉnh lệch khỏi ô nguyên hoặc không vừa bàn.
        issues.push({ levelId, field: `${pField}.frameSize`, code: 'invalid-frame-for-shape' });
      } else if (cellsValid && Number.isInteger(p.frameSize) && p.frameSize > 0) {
        const expected = new Set(
          shapeCells(p.shapeKind, orientation, p.frameSize).map(([x, y]) => `${x},${y}`)
        );
        const actual = new Set(p.cells.map(([x, y]) => `${x},${y}`));
        const same =
          actual.size === p.cells.length &&
          actual.size === expected.size &&
          [...actual].every((k) => expected.has(k));
        if (!same) {
          issues.push({ levelId, field: `${pField}.cells`, code: 'shape-cells-mismatch' });
        }
      }

      if (!Array.isArray(p.anchors) || p.anchors.length === 0) {
        issues.push({ levelId, field: `${pField}.anchors`, code: 'empty-anchors' });
      } else {
        const anchorIds = new Set<string>();
        for (const anchor of p.anchors) {
          if (!anchor.id || typeof anchor.id !== 'string') {
            issues.push({ levelId, field: `${pField}.anchors`, code: 'invalid-anchor-id' });
          } else if (anchorIds.has(anchor.id)) {
            issues.push({ levelId, field: `${pField}.anchors`, code: 'duplicate-anchor-id' });
          } else {
            anchorIds.add(anchor.id);
          }

          if (!Number.isInteger(anchor.x) || !Number.isInteger(anchor.y)) {
            issues.push({ levelId, field: `${pField}.anchors`, code: 'invalid-anchor-coord' });
          }
        }

        // Màn đặt tự do: mỗi mảnh đúng một neo A, nằm trên giao điểm lưới (FP-02)
        if (placement === 'free') {
          if (p.anchors.length !== 1 || p.anchors[0].id !== 'A') {
            issues.push({ levelId, field: `${pField}.anchors`, code: 'free-placement-extra-anchor' });
          }
          const offGrid = p.anchors.some(
            (a) =>
              Number.isInteger(a.x) &&
              Number.isInteger(a.y) &&
              (a.x % GRID_STEP !== 0 || a.y % GRID_STEP !== 0)
          );
          if (offGrid) {
            issues.push({ levelId, field: `${pField}.anchors`, code: 'free-placement-off-grid' });
          }
        }
      }

      if (p.id && Array.isArray(p.cells) && Array.isArray(p.anchors)) {
        parsedPieces.push({
          id: p.id,
          frameSize: p.frameSize,
          cells: p.cells.map(([x, y]) => [x, y] as const),
          anchors: p.anchors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
          color: 'amber',
          shapeKind: p.shapeKind,
          orientation,
          ...(Array.isArray(p.drives) && p.drives.length > 0 ? { drives: [...p.drives] } : {}),
        });
      }
    }
  }

  // Links require rotation and known piece ids, without self-links or duplicates.
  if (Array.isArray(doc.pieces)) {
    const links = new Map<string, readonly string[]>();
    for (const [pIdx, p] of doc.pieces.entries()) {
      if (!p || p.drives === undefined) continue;
      const field = `pieces[${pIdx}].drives`;
      if (!Array.isArray(p.drives)) {
        issues.push({ levelId, field, code: 'invalid-drives' });
        continue;
      }
      if (p.drives.length > 0 && doc.rotationEnabled !== true) {
        issues.push({ levelId, field, code: 'drives-without-rotation' });
      }
      if (new Set(p.drives).size !== p.drives.length) {
        issues.push({ levelId, field, code: 'drives-duplicate' });
      }
      for (const target of p.drives) {
        if (target === p.id) issues.push({ levelId, field, code: 'drives-self' });
        else if (!pieceIds.has(target)) issues.push({ levelId, field, code: 'drives-unknown-piece' });
      }
      links.set(p.id, p.drives.filter((id) => id !== p.id && pieceIds.has(id)));
    }
    // Cycles and two-way links are allowed; the target must be reachable and no two buttons may be identical.
    const group = (id: string) => [id, ...(links.get(id) ?? [])].sort().join(',');
    const drivers = [...links.entries()].filter(([, list]) => list.length > 0).map(([id]) => id);
    const seenGroups = new Set<string>();
    for (const id of drivers) {
      const key = group(id);
      if (seenGroups.has(key)) issues.push({ levelId, field: 'pieces.drives', code: 'drives-degenerate' });
      else seenGroups.add(key);
    }
    const solution = Array.isArray(doc.sampleSolutions) ? doc.sampleSolutions[0] : undefined;
    if (drivers.length > 0 && Array.isArray(solution)) {
      const ids = parsedPieces.map((p) => p.id);
      const target: Record<string, number> = {};
      for (const step of solution) if (step && typeof step.pieceId === 'string') target[step.pieceId] = step.turns ?? 0;
      const periods = Object.fromEntries(parsedPieces.map((p) => [p.id, turnPeriod(p.shapeKind)]));
      if (pressPlan(ids, Object.fromEntries(links), target, periods) === null) {
        issues.push({ levelId, field: 'sampleSolutions[0]', code: 'drives-target-unreachable' });
      }
    }
  }

  // Màn xoay: mảnh giống nhau (cùng hình, cùng khung, xoay thành nhau được) phải cùng hướng
  // ở khay, để đổi chỗ được như mảnh giống hệt. Tam giác góc (0-3) và mái (4-7) là hai bộ riêng.
  if (doc.rotationEnabled === true) {
    const trayOrientation = new Map<string, number>();
    for (const piece of parsedPieces) {
      if (!piece.shapeKind) continue;
      const orientation = piece.orientation ?? 0;
      const reachable = [0, 1, 2, 3].map((turns) => effectiveOrientation(piece.shapeKind!, orientation, turns));
      const key = `${piece.shapeKind}:${piece.frameSize}:${Math.min(...reachable)}`;
      const seen = trayOrientation.get(key);
      if (seen === undefined) {
        trayOrientation.set(key, orientation);
      } else if (seen !== orientation) {
        issues.push({ levelId, field: `pieces.${piece.id}.orientation`, code: 'rotation-uniform-orientation' });
      }
    }
  }

  // Target cells validation
  const targetMask = new Uint8Array(TOTAL_CELLS);
  if (!Array.isArray(doc.targetCells) || doc.targetCells.length === 0) {
    issues.push({ levelId, field: 'targetCells', code: 'empty-target' });
  } else {
    for (const cell of doc.targetCells) {
      if (
        !Array.isArray(cell) ||
        cell.length !== 2 ||
        !Number.isInteger(cell[0]) ||
        !Number.isInteger(cell[1]) ||
        cell[0] < 0 ||
        cell[0] >= GRID_WIDTH ||
        cell[1] < 0 ||
        cell[1] >= GRID_HEIGHT
      ) {
        issues.push({ levelId, field: 'targetCells', code: 'target-cell-out-of-bounds' });
        break;
      }
      targetMask[cell[1] * GRID_WIDTH + cell[0]] = 1;
    }
  }

  let firstPlacements: Placement[] | undefined;

  // Sample solutions validation
  if (!Array.isArray(doc.sampleSolutions) || doc.sampleSolutions.length === 0) {
    issues.push({ levelId, field: 'sampleSolutions', code: 'missing-solutions' });
  } else if (parsedPieces.length > 0 && Array.isArray(doc.targetCells) && doc.targetCells.length > 0) {
    const dummyLevel: Level = {
      id: levelId,
      title: doc.title ?? '',
      chapter: (doc.chapter ?? 1) as Chapter,
      contentRevision: doc.contentRevision ?? '',
      rotationEnabled: Boolean(doc.rotationEnabled),
      placement,
      pieces: parsedPieces,
      targetMask,
    };

    for (let sIdx = 0; sIdx < doc.sampleSolutions.length; sIdx++) {
      const solution: Array<{ pieceId?: string; anchorId?: string; turns?: Turns }> | undefined =
        doc.sampleSolutions[sIdx];
      const sField = `sampleSolutions[${sIdx}]`;

      if (!Array.isArray(solution)) {
        issues.push({ levelId, field: sField, code: 'invalid-solution' });
        continue;
      }

      const placements: Placement[] = [];
      const coverage = new Uint8Array(TOTAL_CELLS);

      for (const step of solution) {
        if (!step || typeof step !== 'object') {
          issues.push({ levelId, field: sField, code: 'invalid-solution-step' });
          continue;
        }

        const piece: Piece | undefined = parsedPieces.find((p) => p.id === step.pieceId);
        if (!piece) {
          issues.push({ levelId, field: sField, code: 'unknown-solution-piece' });
          continue;
        }

        const anchor = piece.anchors.find((a: { id: string; x: number; y: number }) => a.id === step.anchorId);
        if (!anchor) {
          issues.push({ levelId, field: sField, code: 'unknown-anchor' });
          continue;
        }

        if (chapterRule && !chapterRule.rotationEnabled && step.turns !== 0) {
          issues.push({ levelId, field: sField, code: 'solution-rotation-disallowed' });
        }

        const turns = (step.turns ?? 0) as Turns;
        const rotatedCells = turnedCells(piece, turns);
        if (!fitsBoard(rotatedCells, anchor.x, anchor.y)) {
          issues.push({ levelId, field: sField, code: 'solution-piece-out-of-bounds' });
          continue;
        }

        // Chương 1 và 3 (xoay không XOR): cấm xếp chồng / giao nhau trong nghiệm
        if (NO_OVERLAP_CHAPTERS.includes(doc.chapter as number)) {
          for (const [cx, cy] of rotatedCells) {
            const idx = (anchor.y + cy) * GRID_WIDTH + (anchor.x + cx);
            if (coverage[idx] > 0) {
              issues.push({ levelId, field: sField, code: `chapter-${doc.chapter}-no-overlap` });
              break;
            }
            coverage[idx]++;
          }
        }

        placements.push({
          pieceId: piece.id,
          x: anchor.x,
          y: anchor.y,
          turns,
        });
      }

      if (placements.length === solution.length) {
        try {
          const solutionMask = evaluate(dummyLevel, placements);
          if (!matchesTarget(solutionMask, targetMask)) {
            issues.push({ levelId, field: sField, code: 'solution-target-mismatch' });
          }
        } catch (err) {
          issues.push({ levelId, field: sField, code: (err as Error).message });
        }
      }
      if (doc.chapter === ROTATION_CHAPTER && solution.every((step) => (step?.turns ?? 0) === 0)) {
        issues.push({ levelId, field: sField, code: 'chapter-3-needs-rotation' });
      }
      if (sIdx === 0 && placements.length === solution.length) {
        firstPlacements = placements;
      }
    }
  }

  const computedPar = parFromSolution(firstPlacements ?? []);
  if (doc.parMs !== undefined && doc.parMs !== computedPar) {
    issues.push({ levelId, field: 'parMs', code: 'par-mismatch' });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    level: {
      id: levelId,
      title: doc.title!,
      chapter: doc.chapter as Chapter,
      contentRevision: doc.contentRevision ?? 'v1',
      rotationEnabled: doc.rotationEnabled!,
      placement,
      pieces: parsedPieces,
      targetMask,
      victoryVerse: doc.victoryVerse,
      targetPlacements: firstPlacements ?? [],
      parMs: computedPar,
    },
  };
}
