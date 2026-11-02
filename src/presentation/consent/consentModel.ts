import type { PrivacyPurpose, PrivacyState } from '../../application/privacyChoices.ts';

export type ConsentAction = 'accept_all' | 'reject_all' | 'save';

/** Kết quả của màn đồng ý. Mục không có trong bản build này luôn tắt. */
export function choicesFor(
  action: ConsentAction,
  offered: readonly PrivacyPurpose[],
  switches: Partial<PrivacyState>
): PrivacyState {
  const pick = (purpose: PrivacyPurpose): boolean => {
    if (!offered.includes(purpose)) return false;
    if (action === 'accept_all') return true;
    if (action === 'reject_all') return false;
    return switches[purpose] === true;
  };
  return { analytics: pick('analytics'), diagnostics: pick('diagnostics'), ads: pick('ads') };
}
