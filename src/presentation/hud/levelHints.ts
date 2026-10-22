import { FtueController } from '../../application/ftue.ts';
import { ftueStepsOf } from '../../content/catalog.ts';
import type { CommonTranslationKey } from '../../localization/types.ts';

/**
 * Bước hướng dẫn nào có câu chữ theo ngôn ngữ thì mới được hiện. Các bước ftue cũ của
 * chương 1–2 (`drag-first`…) vẫn là dữ liệu tiếng Việt chưa có bản dịch, chúng đã được
 * thay bằng gợi ý kéo thả (`snapAssist`), nên không hiện ở đây.
 */
export const HINT_TEXT_KEYS: Readonly<Record<string, CommonTranslationKey>> = {
  'rotate-first': 'hint_rotate_first',
  'linked-rotation': 'hint_linked_rotation',
};

export function hintTextKey(stepId: string | null): CommonTranslationKey | null {
  return stepId !== null ? (HINT_TEXT_KEYS[stepId] ?? null) : null;
}

/** Bộ điều khiển gợi ý của một màn campaign; null nếu màn không có gợi ý hiển thị được. */
export function hintController(levelId: string): FtueController | null {
  const steps = ftueStepsOf(levelId).filter((step) => hintTextKey(step.id) !== null);
  return steps.length > 0 ? new FtueController(steps) : null;
}
