import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { openLegalAcceptance, closeLegalAcceptance, isLegalAcceptanceOpen } from '../src/presentation/legal/legalAcceptance.ts';
import { closeLegalDocument, isLegalDocumentOpen } from '../src/presentation/legal/legalViewer.ts';
import { dismissTopLegalOverlay } from '../src/presentation/legal/legalOverlay.ts';
import { fakeDocument } from './helpers/fakeDocument.ts';
import { setLocale, t } from '../src/presentation/i18n.ts';
import type { PrivacyPurpose } from '../src/application/privacyChoices.ts';

let d: ReturnType<typeof fakeDocument>;
beforeEach(() => { d = fakeDocument(); vi.stubGlobal('document', d.doc); setLocale('en-US'); });
afterEach(() => { closeLegalAcceptance(); vi.unstubAllGlobals(); setLocale('en-US'); });

it('substitutes localized notice placeholders with inline links and offers Agree and Close', () => {
  const accept = vi.fn();
  openLegalAcceptance(accept);
  expect(d.byId('legal-notice').textContent).toBe('By continuing, you agree to our Terms of Service and confirm you have read our Privacy Policy.');
  expect(d.byId('legal-settings-hint').textContent).toBe(t('legal_settings_hint'));
  expect(d.byId('legal-acceptance-close').attrs['aria-label']).toBe(t('legal_close'));
  expect(d.tags('a')).toHaveLength(2);
  d.byId('legal-link-terms').fire('click');
  expect(d.byId('legal-document-title').textContent).toBe(t('terms_of_service'));
  closeLegalDocument();
  d.byId('legal-link-privacy').fire('click');
  expect(d.byId('legal-document-title').textContent).toBe(t('privacy_policy'));
  closeLegalDocument();
  d.byId('legal-accept').fire('click');
  expect(accept).toHaveBeenCalledOnce();
  expect(isLegalAcceptanceOpen()).toBe(false);
});

it.each(['Escape', 'back', 'close'])('%s closes only the top layer and never accepts', (action) => {
  const accept = vi.fn();
  openLegalAcceptance(accept);
  const popup = d.byId('legal-acceptance');
  const link = d.byId('legal-link-terms'); link.focus(); link.fire('click');
  expect(popup.inert).toBe(true);
  if (action === 'Escape') d.fake.key('Escape');
  else if (action === 'back') expect(dismissTopLegalOverlay()).toBe(true);
  else d.byId('legal-document-close').fire('click');
  expect(isLegalDocumentOpen()).toBe(false);
  expect(isLegalAcceptanceOpen()).toBe(true);
  expect(popup.inert).toBe(false);
  expect(d.fake.activeElement).toBe(link);
  if (action === 'Escape') d.fake.key('Escape');
  else if (action === 'back') expect(dismissTopLegalOverlay()).toBe(true);
  else d.byId('legal-acceptance-close').fire('click');
  expect(isLegalAcceptanceOpen()).toBe(false);
  expect(accept).not.toHaveBeenCalled();
  expect(dismissTopLegalOverlay()).toBe(false);
  openLegalAcceptance(accept);
  expect(isLegalAcceptanceOpen()).toBe(true);
});

it('is single-instance and cleanup also removes the nested viewer and listeners', () => {
  openLegalAcceptance(vi.fn()); openLegalAcceptance(vi.fn());
  expect(d.fake.body.children).toHaveLength(1);
  d.byId('legal-link-terms').fire('click');
  closeLegalAcceptance();
  expect(d.fake.body.children).toHaveLength(0);
  expect(d.fake.listeners.get('keydown')?.size).toBe(0);
  expect(dismissTopLegalOverlay()).toBe(false);
});

it.each(['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel'])(
  'blocks %s from reaching Phaser global handlers while preserving native default actions', type => {
    const gameInput = vi.fn();
    d.doc.addEventListener(type, gameInput);
    openLegalAcceptance(vi.fn());
    expect(d.byId('legal-notice').fire(type).defaultPrevented).toBe(false);
    expect(gameInput).not.toHaveBeenCalled();
    d.byId('legal-link-terms').fire('click');
    expect(d.byId('legal-document-body').fire(type).defaultPrevented).toBe(false);
    expect(gameInput).not.toHaveBeenCalled();
    closeLegalAcceptance();
    d.fake.body.fire(type);
    expect(gameInput).toHaveBeenCalledOnce();
  }
);

it.each(['en-US', 'vi', 'es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'id'] as const)('replaces both notice placeholders in %s', locale => {
  setLocale(locale); openLegalAcceptance(vi.fn(), ['analytics', 'diagnostics', 'ads']);
  expect(d.byId('legal-notice').textContent).not.toMatch(/\{terms\}|\{privacy\}/);
  expect(d.byId('legal-notice').textContent).toContain(t('legal_notice_optional'));
  expect(d.tags('a')).toHaveLength(2);
});

it.each<{ offered: readonly PrivacyPurpose[] }>([{ offered: [] }, { offered: ['analytics'] }, { offered: ['diagnostics'] }, { offered: ['ads'] }])('shows the optional sentence only for offered purposes: $offered', ({ offered }) => {
  openLegalAcceptance(vi.fn(), offered);
  const base = 'By continuing, you agree to our Terms of Service and confirm you have read our Privacy Policy.';
  const optional = ' Tapping Agree also turns on gameplay statistics, error reports and personalised ads.';
  expect(d.byId('legal-notice').textContent).toBe(base + (offered.length ? optional : ''));
});

it('wires Android Back before transitions and provides privacy services before Phaser boot', () => {
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const handler = main.slice(main.indexOf('onHardwareBack: () =>'));
  expect(handler.indexOf('dismissTopLegalOverlay()')).toBeGreaterThan(-1);
  expect(handler.indexOf('dismissTopLegalOverlay()')).toBeLessThan(handler.indexOf('director.isTransitioning()'));
  expect(main).not.toContain('requestPrivacyChoices');
  expect(main).toMatch(/preBoot:[\s\S]*?registry\.set\(PRIVACY_REGISTRY_KEY/);
});
