import { describe, expect, test, vi } from 'vitest';
import type { PrivacyPurpose } from '../src/application/privacyChoices.ts';
import { requestPrivacyChoices } from '../src/presentation/consent/consentGate.ts';

type El = {
  tag: string;
  attrs: Record<string, string>;
  textContent: string;
  type: string;
  href: string;
  children: El[];
  listeners: Record<string, (event?: unknown) => void>;
  style: { cssText: string };
  removed: boolean;
  focus?: () => void;
  setAttribute(k: string, v: string): void;
  append(...children: El[]): void;
  appendChild(child: El): void;
  addEventListener(event: string, listener: (event?: unknown) => void): void;
  remove(): void;
};

function fakeDoc(withFocus = true) {
  const all: El[] = [];
  function make(tag: string): El {
    const el: El = {
      tag, attrs: {} as Record<string, string>, textContent: '', type: '', href: '',
      children: [],
      listeners: {} as Record<string, (event?: unknown) => void>,
      style: { cssText: '' }, removed: false,
      focus: withFocus ? vi.fn() : undefined,
      setAttribute(k: string, v: string) { this.attrs[k] = v; },
      append(...c: El[]) { this.children.push(...c); },
      appendChild(c: El) { this.children.push(c); },
      addEventListener(ev: string, fn: (event?: unknown) => void) { this.listeners[ev] = fn; },
      remove() { this.removed = true; },
    };
    all.push(el);
    return el;
  }
  const body = make('body');
  const doc = { createElement: make, body } as unknown as Document;
  const byId = (id: string) => all.find((e) => e.attrs['data-id'] === id)!;
  return { doc, all, byId, overlay: () => body.children[0] };
}

const T = (key: string) => key;
const offerings: PrivacyPurpose[][] = [[], ['analytics'], ['diagnostics'], ['analytics', 'diagnostics'], ['ads'], ['analytics', 'diagnostics', 'ads']];

describe('requestPrivacyChoices', () => {
  for (const offered of offerings) {
    test(`Reject disables all purposes (${offered.join(', ')})`, async () => {
      const d = fakeDoc();
      const done = requestPrivacyChoices({ offered, doc: d.doc, translate: T });
      d.byId('reject').listeners.click();
      await expect(done).resolves.toEqual({ analytics: false, diagnostics: false, ads: false });
      expect(d.overlay().removed).toBe(true);
    });

    test(`Accept enables only offered purposes (${offered.join(', ')})`, async () => {
      const d = fakeDoc();
      const done = requestPrivacyChoices({ offered, doc: d.doc, translate: T });
      d.byId('accept').listeners.click();
      await expect(done).resolves.toEqual({
        analytics: offered.includes('analytics'), diagnostics: offered.includes('diagnostics'), ads: offered.includes('ads'),
      });
      expect(d.overlay().removed).toBe(true);
    });

    test(`bullets describe only offered services (${offered.join(', ')})`, () => {
      const d = fakeDoc();
      void requestPrivacyChoices({ offered, doc: d.doc, translate: T });
      expect(d.all.filter((e) => e.tag === 'li').map((e) => e.textContent)).toEqual([
        'privacy_bullet_play',
        ...(offered.includes('analytics') ? ['privacy_bullet_analytics'] : []),
        ...(offered.includes('diagnostics') ? ['privacy_bullet_diagnostics'] : []),
        ...(offered.includes('ads') ? ['privacy_bullet_ads'] : []),
      ]);
      expect(d.byId('settings-hint').textContent).toBe('privacy_settings_hint');
    });
  }

  test('offers two buttons with equal geometry and typography, Accept on the right and Reject initially focused', () => {
    const d = fakeDoc();
    void requestPrivacyChoices({ offered: ['analytics', 'diagnostics'], doc: d.doc, translate: T });
    const buttons = d.all.filter((e) => e.tag === 'button');
    expect(buttons).toEqual([d.byId('reject'), d.byId('accept')]);
    expect(buttons.map((e) => e.type)).toEqual(['button', 'button']);
    expect(buttons.map((e) => e.textContent)).toEqual(['privacy_reject', 'privacy_accept']);
    for (const property of [
      'box-sizing', 'width', 'min-width', 'min-height', 'padding', 'border-radius',
      'border-width', 'border-style', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'line-height',
    ]) {
      const declaration = new RegExp(`(?:^|;)${property}:([^;]+);`);
      const rejectValue = declaration.exec(buttons[0].style.cssText)?.[1];
      const acceptValue = declaration.exec(buttons[1].style.cssText)?.[1];
      expect(rejectValue, property).toBeDefined();
      expect(rejectValue, property).toBe(acceptValue);
    }
    expect(d.byId('actions').children).toEqual(buttons);
    expect(d.byId('actions').children[1]).toBe(d.byId('accept'));
    expect(d.all.some((e) => ['options', 'options-panel', 'save'].includes(e.attrs['data-id']) ||
      e.attrs['data-id']?.startsWith('switch-'))).toBe(false);
    expect(d.overlay().attrs).toMatchObject({ role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': d.byId('privacy-title').attrs.id });
    expect(d.byId('privacy-title').textContent).toBe('privacy_title');
    expect(d.byId('reject').focus).toHaveBeenCalledOnce();
  });

  test('supports documents without focus', () => {
    const d = fakeDoc(false);
    expect(() => requestPrivacyChoices({ offered: [], doc: d.doc, translate: T })).not.toThrow();
  });

  test('shows the policy link only when a URL is provided', () => {
    const withUrl = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], policyUrl: 'https://x.test/p', doc: withUrl.doc, translate: T });
    expect(withUrl.byId('policy').href).toBe('https://x.test/p');
    const without = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], doc: without.doc, translate: T });
    expect(without.byId('policy')).toBeUndefined();
  });

  test('prevents policy navigation and calls the injected opener', () => {
    const d = fakeDoc();
    const open = vi.fn();
    void requestPrivacyChoices({ offered: ['diagnostics'], policyUrl: 'https://x.test/p', doc: d.doc, translate: T, open });
    const preventDefault = vi.fn();
    d.byId('policy').listeners.click({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('https://x.test/p');
  });
});
