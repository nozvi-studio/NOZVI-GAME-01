/**
 * Chuỗi và định dạng của HUD.
 *
 * Tách khỏi Hud.ts vì file đó import Phaser, mà Phaser cần `window` nên
 * không nạp được trong vitest. Phần thuần nằm riêng thì test được trực tiếp.
 */
import {
  getChapterName,
  getChapterTagline,
  getGalaxyType,
  getLevelTitle,
  getNextChapterVerse,
  getVictoryVerse,
  peekChapterVerse,
  t,
} from '../i18n.ts';
import { chapterOfLevelId } from '../../content/chapters.ts';
import type { Chapter } from '../../domain/model.ts';

/**
 * Nhãn nổi cạnh mảnh khi kéo trúng vùng hít.
 *
 * Là hàm chứ không phải hằng số: hằng số bị cố định ở thời điểm nạp module nên
 * đổi ngôn ngữ xong vẫn ra chuỗi cũ. Bản tiếng Việt nằm trong `i18n.ts`.
 */
export function getSnapHintText(): string {
  return t('snap_hint');
}

const SNAP_HINT_MIN_WIDTH = 160;
const SNAP_HINT_HEIGHT = 44;
const SNAP_HINT_PADDING_X = 18;

/**
 * Kích thước viên thuốc của nhãn hít theo bề rộng chữ đã đo. Chiều rộng cố định
 * từng làm chữ các ngôn ngữ dài (fr, de, id...) tràn ra ngoài viền.
 */
export function snapHintPillSize(textWidth: number): { width: number; height: number } {
  return {
    width: Math.max(SNAP_HINT_MIN_WIDTH, Math.ceil(textWidth) + SNAP_HINT_PADDING_X * 2),
    height: SNAP_HINT_HEIGHT,
  };
}

/** Cỡ chữ kiến thức chiến thắng nổi bật và dễ đọc */
export const VICTORY_VERSE_FONT_SIZE = 24;

/** Nội dung thanh đếm ở đáy màn chơi */
export function formatMatchCount(matched: number, total: number): string {
  return t('match_count', { matched, total });
}

/** Nhãn của màn hoàn thành. Gọi lúc dựng, xem ghi chú ở `getSnapHintText`. */
export function getVictoryLabels() {
  const labels = {
    title: t('victory_title'),
    next: t('victory_next'),
    levelSelect: t('victory_level_select'),
  };
  Object.defineProperty(labels, 'eyebrow', {
    value: t('victory_eyebrow' as any),
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return labels as {
    eyebrow: string;
    title: string;
    next: string;
    levelSelect: string;
  };
}

/** Chỉ số tiến độ ở header màn chọn màn, ví dụ "1/18" */
export function formatProgress(completed: number, total: number): string {
  return `${completed}/${total}`;
}

/**
 * Current-node label, split into its two lines. UI copy stays plain and the
 * decoration lives in the visuals, so neither line carries an ornament.
 */
export function formatNodeLabel(
  id: string,
  chapter: Chapter
): { name: string; locator: string };
export function formatNodeLabel(
  id: string,
  title: string,
  chapter: Chapter
): { name: string; locator: string };
export function formatNodeLabel(
  id: string,
  arg2: Chapter | string,
  arg3?: Chapter
): { name: string; locator: string } {
  if (typeof arg2 === 'string' && arg3 !== undefined) {
    return {
      name: getLevelTitle(id, arg2),
      locator: `${id} · ${getChapterName(arg3)}`,
    };
  }
  const chapter = arg2 as Chapter;
  const chapterName = getChapterName(chapter);
  const galaxyType = getGalaxyType(chapter);
  return {
    name: t('level_badge_label' as any, { id }),
    locator: `${chapterName} · ${galaxyType}`,
  };
}

export function formatMenuContinueSubtext(levelId: string): string {
  const ch = chapterOfLevelId(levelId);
  const levelLabel = t('level_badge_label' as any, { id: levelId });
  return ch ? `${levelLabel} · ${getChapterName(ch)}` : levelLabel;
}

export interface ResolveVictoryVerseOptions {
  mode?: string;
  levelId: string;
  endlessChapter?: number;
  fallbackVerse?: string;
  overrideFact?: string | null;
  drawNextVerse?: (chapter: number) => string;
  peekVerse?: (chapter: number) => string;
}

export function resolveVictoryVerse(options: ResolveVictoryVerseOptions): string {
  if (options.overrideFact) {
    return options.overrideFact;
  }

  const chapter = options.mode === 'endless'
    ? (options.endlessChapter ?? 1)
    : (chapterOfLevelId(options.levelId) ?? 1);

  // Chapters 1, 2, 3 have pools
  const hasPool = chapter >= 1 && chapter <= 3;

  if (hasPool) {
    if (options.mode === 'harness') {
      const peek = options.peekVerse ?? peekChapterVerse;
      return peek(chapter);
    }
    const draw = options.drawNextVerse ?? getNextChapterVerse;
    return draw(chapter);
  }

  // Fallback for chapters without pools or dev levels
  if (options.mode === 'endless') {
    return getChapterTagline(chapter, options.fallbackVerse) || options.fallbackVerse || '';
  }

  return getVictoryVerse(options.levelId, options.fallbackVerse);
}
