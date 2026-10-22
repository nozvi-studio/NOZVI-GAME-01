import type { LevelSource } from './authoring.ts';

function escapeStr(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Tuần tự hoá một đối tượng LevelSource thành chuỗi mã nguồn TypeScript (.ts).
 * Tuân thủ đúng định dạng của các file nguồn trong src/content/sources/ (spec E, Quyết định 2).
 */
export function serializeLevelSource(source: LevelSource, constName: string): string {
  const lines: string[] = [
    "import type { LevelSource } from '../authoring.ts';",
    '',
    `export const ${constName}: LevelSource = {`,
    `  id: '${source.id}',`,
    `  title: '${escapeStr(source.title)}',`,
    `  chapter: ${source.chapter},`,
    `  order: ${source.order},`,
    `  contentRevision: '${source.contentRevision}',`,
    `  rotationEnabled: ${source.rotationEnabled},`,
  ];

  if (source.placement !== undefined) {
    lines.push(`  placement: '${source.placement}',`);
  }
  if (source.allowUnproven !== undefined) {
    lines.push(`  allowUnproven: { reason: '${escapeStr(source.allowUnproven.reason)}' },`);
  }

  // pieces
  lines.push('  pieces: [');
  for (const piece of source.pieces) {
    lines.push('    {');
    lines.push(`      id: '${piece.id}',`);
    lines.push(`      shapeKind: '${piece.shapeKind}',`);
    lines.push(`      orientation: ${piece.orientation},`);
    lines.push(`      frameSize: ${piece.frameSize},`);
    if (piece.drives && piece.drives.length > 0) {
      lines.push(`      drives: [${piece.drives.map((id) => `'${id}'`).join(', ')}],`);
    }
    lines.push('      anchors: [');
    for (const anchor of piece.anchors) {
      lines.push(`        { id: '${anchor.id}', x: ${anchor.x}, y: ${anchor.y} },`);
    }
    lines.push('      ],');
    lines.push('    },');
  }
  lines.push('  ],');

  // sampleSolutions
  if (source.sampleSolutions.length === 0) {
    lines.push('  sampleSolutions: [],');
  } else {
    lines.push('  sampleSolutions: [');
    for (const sol of source.sampleSolutions) {
      lines.push('    [');
      for (const step of sol) {
        lines.push(
          `      { pieceId: '${step.pieceId}', anchorId: '${step.anchorId}', turns: ${step.turns} },`
        );
      }
      lines.push('    ],');
    }
    lines.push('  ],');
  }

  // learningObjective & difficultyEstimate
  lines.push(`  learningObjective: '${escapeStr(source.learningObjective)}',`);
  lines.push(`  difficultyEstimate: ${source.difficultyEstimate},`);

  // distractors
  if (source.distractors.length === 0) {
    lines.push('  distractors: [],');
  } else {
    lines.push('  distractors: [');
    for (const d of source.distractors) {
      if (d.anchorId !== undefined && d.anchorId !== null) {
        lines.push(
          `    { pieceId: '${d.pieceId}', anchorId: '${d.anchorId}', reason: '${escapeStr(d.reason)}' },`
        );
      } else {
        lines.push(`    { pieceId: '${d.pieceId}', reason: '${escapeStr(d.reason)}' },`);
      }
    }
    lines.push('  ],');
  }

  // ftueSteps
  if (source.ftueSteps.length === 0) {
    lines.push('  ftueSteps: [],');
  } else {
    lines.push('  ftueSteps: [');
    for (const s of source.ftueSteps) {
      lines.push(
        `    { id: '${s.id}', trigger: '${s.trigger}', end: '${s.end}', text: '${escapeStr(s.text)}' },`
      );
    }
    lines.push('  ],');
  }

  if (source.victoryVerse !== undefined) {
    lines.push(`  victoryVerse: '${escapeStr(source.victoryVerse)}',`);
  }

  lines.push('};');
  lines.push('');

  return lines.join('\n');
}
