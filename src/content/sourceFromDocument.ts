import type { Chapter, Orientation } from '../domain/model.ts';
import type { LevelSource } from './authoring.ts';
import type { LevelDocument } from './document.ts';

export type SourceFromDocumentOverride = {
  id?: string;
  chapter?: Chapter;
  order?: number;
  title?: string;
  contentRevision?: string;
};

/**
 * Chuyển một LevelDocument sang LevelSource:
 * - Bỏ các trường tự sinh: schemaVersion, board, targetCells, cells của từng mảnh, color
 * - Giữ các trường dữ liệu cấp màn và mảnh
 * - Cho phép ghi đè id, chapter, order, title, contentRevision
 */
export function sourceFromDocument(
  doc: LevelDocument,
  override?: SourceFromDocumentOverride
): LevelSource {
  const source: LevelSource = {
    id: override?.id ?? doc.id,
    title: override?.title ?? doc.title,
    chapter: override?.chapter ?? doc.chapter,
    order: override?.order ?? doc.order,
    contentRevision: override?.contentRevision ?? doc.contentRevision,
    rotationEnabled: doc.rotationEnabled,
    difficultyEstimate: doc.difficultyEstimate,
    learningObjective: doc.learningObjective,
    distractors: doc.distractors ? [...doc.distractors] : [],
    ftueSteps: doc.ftueSteps ? [...doc.ftueSteps] : [],
    pieces: doc.pieces.map((p) => ({
      id: p.id,
      shapeKind: p.shapeKind,
      orientation: (p.orientation ?? 0) as Orientation,
      frameSize: p.frameSize,
      anchors: p.anchors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
      ...(p.drives && p.drives.length > 0 ? { drives: [...p.drives] } : {}),
    })),
    sampleSolutions: doc.sampleSolutions.map((sol) =>
      sol.map((step) => ({
        pieceId: step.pieceId,
        anchorId: step.anchorId,
        turns: step.turns,
      }))
    ),
  };

  if (doc.placement) {
    source.placement = doc.placement;
  }
  if (doc.allowUnproven) {
    source.allowUnproven = doc.allowUnproven;
  }
  if (doc.victoryVerse) {
    source.victoryVerse = doc.victoryVerse;
  }

  return source;
}
