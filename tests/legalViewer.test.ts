import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderLegalMarkdown } from '../src/presentation/legal/legalMarkdown.ts';
import { closeLegalDocument, isLegalDocumentOpen, openLegalDocument } from '../src/presentation/legal/legalViewer.ts';
import { openExternal } from '../src/presentation/openExternal.ts';
import { setLocale } from '../src/presentation/i18n.ts';
import { fakeDocument } from './helpers/fakeDocument.ts';

vi.mock('../src/presentation/openExternal.ts', () => ({ openExternal: vi.fn() }));
let d: ReturnType<typeof fakeDocument>;
beforeEach(() => { d = fakeDocument(); vi.stubGlobal('document', d.doc); setLocale('en-US'); });
afterEach(() => { closeLegalDocument(); vi.unstubAllGlobals(); vi.clearAllMocks(); setLocale('en-US'); });

describe('safe legal Markdown', () => {
  function render(source: string) { const el = renderLegalMarkdown(source, d.doc); d.doc.body.append(el); return el; }
  it('strips multiline and inline comments before parsing', () => {
    const el = render('# Title\n<!-- secret\n# Hidden\n-->\nHello <!-- internal -->world');
    expect(el.textContent).toBe('TitleHello world');
    expect(d.tags('h1')).toHaveLength(1);
  });
  it('renders HTML and scripts literally without creating unsafe elements', () => {
    const source = '<script>alert(1)</script> <img src=x onerror=alert(1)> &lt;b&gt;';
    expect(render(source).textContent).toBe(source);
    expect(d.tags('script')).toHaveLength(0);
    expect(d.tags('img')).toHaveLength(0);
  });
  it('supports headings, paragraphs, emphasis, bullets and scrollable tables', () => {
    render('## Heading\n\nA **bold** and *italic* paragraph.\n\n- First\n- Second\n\n| Name | Value |\n| --- | --- |\n| One | **Two** |');
    expect(d.tags('h2')[0].textContent).toBe('Heading');
    expect(d.tags('strong').map(e => e.textContent)).toEqual(['bold', 'Two']);
    expect(d.tags('em')[0].textContent).toBe('italic');
    expect(d.tags('li')).toHaveLength(2);
    expect(d.tags('th').map(e => e.textContent)).toEqual(['Name', 'Value']);
    expect(d.tags('td').map(e => e.textContent)).toEqual(['One', 'Two']);
    expect(d.tags('table')[0].parent!.style.cssText).toContain('overflow-x:auto');
  });
  it('allows only valid https links and opens them through openExternal', () => {
    render('[safe](https://example.com/p) [js](javascript:alert) [data](data:text/html,x) [http](http://x.test) [relative](/path)');
    expect(d.tags('a')).toHaveLength(1);
    d.tags('a')[0].fire('click');
    expect(openExternal).toHaveBeenCalledWith('https://example.com/p');
  });
});

describe('legal viewer', () => {
  it('opens one labelled modal, takes focus, traps Tab, closes with Escape and restores focus', () => {
    const opener = d.fake.createElement('button'); d.fake.body.append(opener); opener.focus();
    openLegalDocument('privacy');
    const overlay = d.byId('legal-viewer');
    expect(overlay.attrs).toMatchObject({ role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'legal-document-title' });
    expect(isLegalDocumentOpen()).toBe(true);
    const close = d.byId('legal-document-close');
    expect(d.fake.activeElement).toBe(close);
    d.fake.key('Tab', true);
    expect(d.fake.activeElement).toBe(overlay.querySelectorAll().at(-1));
    d.fake.key('Tab');
    expect(d.fake.activeElement).toBe(close);
    d.fake.key('Escape');
    expect(isLegalDocumentOpen()).toBe(false);
    expect(d.fake.activeElement).toBe(opener);
    expect(opener.inert).toBe(false);
    expect(d.fake.listeners.get('keydown')?.size).toBe(0);
  });
  it('repeated opens replace the document without stacking and Close returns focus', () => {
    const opener = d.fake.createElement('button'); d.fake.body.append(opener); opener.focus();
    openLegalDocument('privacy'); openLegalDocument('terms'); openLegalDocument('terms');
    expect(d.fake.body.children.filter(e => e.attrs['data-id'] === 'legal-viewer')).toHaveLength(1);
    expect(d.byId('legal-document-title').textContent).toBe('Terms of Service');
    d.byId('legal-document-close').fire('click');
    expect(d.fake.activeElement).toBe(opener);
  });
  it.each(['vi', 'en-US', 'es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'id'] as const)('selects bundled content for %s', (locale) => {
    setLocale(locale);
    for (const kind of ['privacy', 'terms'] as const) {
      openLegalDocument(kind);
      const content = d.byId('legal-document-body').textContent;
      expect(content).toContain(locale === 'vi' ? 'Ngày hiệu lực' : 'Effective date');
      expect(content).not.toContain('<!--');
      expect(content).not.toContain('Shared template');
    }
  });
});
