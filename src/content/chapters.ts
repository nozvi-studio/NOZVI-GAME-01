import type { Chapter } from '../domain/model.ts';
import type { ManifestEntry } from './document.ts';

export type ChapterInfo = Readonly<{
  chapter: Chapter;
  roman: string;
  name: string;
  /** Chỉ chương xoay (Chương 3 — Luân Chuyển) được bật `rotationEnabled` (CH-01) */
  rotationEnabled: boolean;
}>;

/** Năm chương của campaign; tên theo bộ mockup năm thiên hà (spec GX2). `rotationEnabled` đi theo nội dung màn (3-x), không theo tên. */
export const CHAPTERS: readonly ChapterInfo[] = [
  { chapter: 1, roman: 'I', name: 'Khởi Nguyên', rotationEnabled: false },
  { chapter: 2, roman: 'II', name: 'Giao Thoa', rotationEnabled: false },
  { chapter: 3, roman: 'III', name: 'Luân Chuyển', rotationEnabled: true },
  { chapter: 4, roman: 'IV', name: 'Hội Tụ', rotationEnabled: false },
  { chapter: 5, roman: 'V', name: 'Lăng Kính', rotationEnabled: false },
];

/** Bản phát hành cần đủ ngần này màn approved (CH-04). */
export const RELEASE_LEVEL_COUNT = 58;

/** Chương dạy xoay mảnh: nghiệm không được xếp chồng (như chương 1) và phải có ít nhất một nấc xoay. */
export const ROTATION_CHAPTER = 3;

/** Chương "chỉ xếp hình": nghiệm không được xếp chồng (không XOR). */
export const NO_OVERLAP_CHAPTERS: readonly number[] = [1, ROTATION_CHAPTER];

/** Chapters that allow piece rotation; same source as the validator's `chapter-rotation-*` rules. */
export function chapterAllowsRotation(chapter: number): boolean {
  return chapterInfo(chapter)?.rotationEnabled ?? false;
}

/** Chapters whose sample solutions must not overlap pieces (`chapter-<n>-no-overlap`). */
export function chapterForbidsOverlap(chapter: number): boolean {
  return NO_OVERLAP_CHAPTERS.includes(chapter);
}

export function chapterInfo(chapter: number): ChapterInfo | undefined {
  return CHAPTERS.find((c) => c.chapter === chapter);
}

/** Số La Mã của chương; mã lạ trả về chính con số. */
export function chapterRoman(chapter: number): string {
  return chapterInfo(chapter)?.roman ?? String(chapter);
}

/** Chương suy từ mã màn "<chương>-<số>"; mã khác (màn dev) trả undefined. */
export function chapterOfLevelId(levelId: string): Chapter | undefined {
  const match = /^(\d+)-/.exec(levelId);
  return match ? chapterInfo(Number(match[1]))?.chapter : undefined;
}

/** Tiêu đề chòm sao: "Chương III · Luân Chuyển". */
export function chapterLabel(chapter: number): string {
  const info = chapterInfo(chapter);
  return info ? `Chương ${info.roman} · ${info.name}` : `Chương ${chapter}`;
}

export function releaseGate(manifest: readonly ManifestEntry[]): { ok: boolean; approved: number; required: number } {
  const approved = manifest.filter((e) => e.status === 'approved').length;
  return {
    ok: manifest.length === RELEASE_LEVEL_COUNT && approved === RELEASE_LEVEL_COUNT,
    approved,
    required: RELEASE_LEVEL_COUNT,
  };
}
