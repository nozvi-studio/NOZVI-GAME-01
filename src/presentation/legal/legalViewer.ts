import privacyVi from '../../../legal/privacy.vi.md?raw';
import privacyEn from '../../../legal/privacy.en.md?raw';
import termsVi from '../../../legal/terms.vi.md?raw';
import termsEn from '../../../legal/terms.en.md?raw';
import { getLocale, t } from '../i18n.ts';
import { openExternal } from '../openExternal.ts';
import { renderLegalMarkdown } from './legalMarkdown.ts';
import { mountLegalOverlay } from './legalOverlay.ts';
import './legal.css';

export type LegalDocumentKind = 'privacy' | 'terms';
let unmount: (() => void) | undefined;

export function isLegalDocumentOpen(): boolean { return !!unmount; }

export function closeLegalDocument(): void {
  const close = unmount;
  unmount = undefined;
  close?.();
}

/**
 * Điều khoản và Chính sách công khai ở trang web (Google Play yêu cầu URL).
 * Trang song ngữ: tiếng Việt là mặc định, `?lang=en` cho mọi ngôn ngữ khác.
 * Bản Markdown trong `legal/` là bản dự phòng khi máy offline; `npm run legal:check` giữ hai bản khớp nhau.
 */
export const LEGAL_URLS: Readonly<Record<LegalDocumentKind, string>> = {
  terms: 'https://dev.nozvi.pages.dev/term-of-service/',
  privacy: 'https://dev.nozvi.pages.dev/privacy-policy/',
};

export function legalDocumentUrl(kind: LegalDocumentKind, locale: string = getLocale()): string {
  return locale === 'vi' ? LEGAL_URLS[kind] : `${LEGAL_URLS[kind]}?lang=en`;
}

function isOnline(): boolean {
  try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch { return true; }
}

/** Online: mở trang web ở trình duyệt hệ thống. Offline: mở bản đóng gói trong game. */
export function openLegalDocument(kind: LegalDocumentKind): void {
  if (isOnline()) {
    closeLegalDocument();
    openExternal(legalDocumentUrl(kind));
    return;
  }
  showBundledLegalDocument(kind);
}

export function showBundledLegalDocument(kind: LegalDocumentKind): void {
  closeLegalDocument();
  const overlay = document.createElement('div');
  overlay.className = 'legal-overlay legal-viewer';
  overlay.setAttribute('data-id', 'legal-viewer');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'legal-document-title');
  const sheet = document.createElement('div');
  sheet.className = 'legal-sheet';
  const bar = document.createElement('header');
  bar.className = 'legal-topbar';
  const title = document.createElement('h1');
  title.setAttribute('id', 'legal-document-title');
  title.setAttribute('data-id', 'legal-document-title');
  title.textContent = t(kind === 'privacy' ? 'privacy_policy' : 'terms_of_service');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'legal-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', t('legal_close'));
  close.setAttribute('data-id', 'legal-document-close');
  close.addEventListener('click', closeLegalDocument);
  bar.append(title, close);
  const vi = getLocale() === 'vi';
  const content = renderLegalMarkdown(kind === 'privacy' ? (vi ? privacyVi : privacyEn) : (vi ? termsVi : termsEn));
  content.className = 'legal-document';
  content.setAttribute('data-id', 'legal-document-body');
  content.setAttribute('lang', vi ? 'vi' : 'en');
  sheet.append(bar, content);
  overlay.append(sheet);
  unmount = mountLegalOverlay(overlay, close, closeLegalDocument);
}
