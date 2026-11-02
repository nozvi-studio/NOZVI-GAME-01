import privacyVi from '../../../legal/privacy.vi.md?raw';
import privacyEn from '../../../legal/privacy.en.md?raw';
import termsVi from '../../../legal/terms.vi.md?raw';
import termsEn from '../../../legal/terms.en.md?raw';
import { getLocale, t } from '../i18n.ts';
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

export function openLegalDocument(kind: LegalDocumentKind): void {
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
  close.textContent = t('legal_close');
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
