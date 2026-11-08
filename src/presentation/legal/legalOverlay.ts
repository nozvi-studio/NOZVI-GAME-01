import { TYPO_TOKENS } from '../designTokens.ts';
type Overlay = { dismiss: () => void };
const stack: Overlay[] = [];

/** Used by Android Back before scene transitions or app exit. */
export function dismissTopLegalOverlay(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.dismiss();
  return true;
}

/** Modal input/focus lifecycle shared by the notice and the viewer stacked over it. */
export function mountLegalOverlay(root: HTMLElement, initialFocus: HTMLElement, dismiss: () => void): () => void {
  const doc = document;
  // Game fonts follow the active locale (CJK stacks), so they are handed to CSS here.
  root.style.cssText += `--legal-font-display:${TYPO_TOKENS.fontFamily.display};--legal-font-body:${TYPO_TOKENS.fontFamily.sans};`;
  const opener = doc.activeElement as HTMLElement | null;
  const blocked = Array.from(doc.body.children).map(el => ({ el: el as HTMLElement, inert: (el as HTMLElement).inert }));
  for (const { el } of blocked) el.inert = true;
  const entry = { dismiss };
  stack.push(entry);
  // Phaser also listens on window for events targeting DOM outside its canvas.
  // Inert siblings alone cannot stop those handlers from hit-testing the game.
  // Do not preventDefault: the document must still scroll and links must work.
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel',
    'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'click']) {
    root.addEventListener(type, event => event.stopPropagation());
  }
  const focusables = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]'));
  const keydown = (event: KeyboardEvent): void => {
    if (stack.at(-1) !== entry) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss();
    } else if (event.key === 'Tab') {
      const controls = focusables();
      const current = controls.indexOf(doc.activeElement as HTMLElement);
      const next = event.shiftKey ? (current <= 0 ? controls.length - 1 : current - 1) : (current + 1) % controls.length;
      event.preventDefault();
      event.stopImmediatePropagation();
      (controls[next] ?? initialFocus).focus();
    }
  };
  const focusin = (): void => {
    if (stack.at(-1) === entry && !root.contains(doc.activeElement)) initialFocus.focus();
  };
  doc.body.append(root);
  doc.addEventListener('keydown', keydown, true);
  doc.addEventListener('focusin', focusin);
  initialFocus.focus();
  let mounted = true;
  return () => {
    if (!mounted) return;
    mounted = false;
    doc.removeEventListener('keydown', keydown, true);
    doc.removeEventListener('focusin', focusin);
    stack.splice(stack.indexOf(entry), 1);
    root.remove();
    for (const { el, inert } of blocked) el.inert = inert;
    if (opener?.isConnected) opener.focus();
  };
}
