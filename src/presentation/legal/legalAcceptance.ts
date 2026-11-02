import { t } from '../i18n.ts';
import type { PrivacyPurpose } from '../../application/privacyChoices.ts';
import { closeLegalDocument, openLegalDocument, type LegalDocumentKind } from './legalViewer.ts';
import { mountLegalOverlay } from './legalOverlay.ts';

let unmount: (() => void) | undefined;

export function isLegalAcceptanceOpen(): boolean { return !!unmount; }

export function closeLegalAcceptance(): void {
  if (!unmount) return;
  closeLegalDocument();
  const close = unmount;
  unmount = undefined;
  close();
}

export function openLegalAcceptance(onAccept: () => void, offered: readonly PrivacyPurpose[] = []): void {
  if (unmount) return;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (id) node.setAttribute('data-id', id);
    return node;
  };
  const overlay = el('div', 'legal-acceptance');
  overlay.className = 'legal-overlay legal-notice-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'legal-acceptance-title');
  const card = el('div');
  card.className = 'legal-notice-card';
  const header = el('header');
  header.className = 'legal-notice-header';
  const title = el('h1');
  title.setAttribute('id', 'legal-acceptance-title');
  title.textContent = t('terms_of_service');
  const close = el('button', 'legal-acceptance-close');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', t('legal_close'));
  close.addEventListener('click', closeLegalAcceptance);
  header.append(title, close);
  const notice = el('p', 'legal-notice');
  // Split only the two known tokens; all other translation content stays literal text.
  for (const part of t('legal_notice').split(/(\{terms\}|\{privacy\})/)) {
    if (part === '{terms}' || part === '{privacy}') {
      const kind: LegalDocumentKind = part === '{terms}' ? 'terms' : 'privacy';
      const link = el('a', `legal-link-${kind}`);
      link.href = `#legal-${kind}`;
      link.textContent = t(kind === 'terms' ? 'terms_of_service' : 'privacy_policy');
      link.addEventListener('click', event => { event.preventDefault(); openLegalDocument(kind); });
      notice.append(link);
    } else {
      const text = el('span');
      text.textContent = part;
      notice.append(text);
    }
  }
  if (offered.length > 0) {
    const optional = el('span');
    optional.textContent = ` ${t('legal_notice_optional')}`;
    notice.append(optional);
  }
  const hint = el('p', 'legal-settings-hint');
  hint.textContent = t('legal_settings_hint');
  const accept = el('button', 'legal-accept');
  accept.type = 'button';
  accept.className = 'legal-accept';
  accept.textContent = t('legal_accept');
  accept.addEventListener('click', () => {
    if (!unmount) return;
    closeLegalAcceptance();
    onAccept();
  });
  card.append(header, notice, hint, accept);
  overlay.append(card);
  unmount = mountLegalOverlay(overlay, close, closeLegalAcceptance);
}
