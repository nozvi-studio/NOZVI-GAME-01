/** Minimal DOM boundary for legal overlays; production parsing and handlers run unchanged. */
export class FakeElement {
  attrs: Record<string, string> = {};
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  style = { cssText: '' };
  listeners = new Map<string, Set<EventListener>>();
  inert = false;
  disabled = false;
  tabIndex = -1;
  type = '';
  href = '';
  private text = '';
  constructor(public tag: string, private doc: FakeDocument) {}
  get isConnected(): boolean { return this === this.doc.body || !!this.parent?.isConnected; }
  get textContent(): string { return this.text + this.children.map(c => c.textContent).join(''); }
  set textContent(value: string) { this.text = value; this.children = []; }
  setAttribute(key: string, value: string) { this.attrs[key] = value; }
  getAttribute(key: string) { return this.attrs[key] ?? null; }
  append(...children: FakeElement[]) { children.forEach(c => { c.parent = this; this.children.push(c); }); }
  appendChild(child: FakeElement) { this.append(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  contains(node: FakeElement): boolean { return this === node || this.children.some(c => c.contains(node)); }
  focus() { this.doc.activeElement = this; }
  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: EventListener) { this.listeners.get(type)?.delete(listener); }
  fire(type: string) {
    let stopped = false;
    let prevented = false;
    const path: Array<FakeElement | FakeDocument> = [];
    for (let el: FakeElement | null = this; el; el = el.parent) path.push(el);
    path.push(this.doc);
    const event = {
      target: this,
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; },
      stopImmediatePropagation() { stopped = true; },
    } as unknown as Event;
    for (const node of path) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
      if (stopped) break;
    }
    return { defaultPrevented: prevented };
  }
  querySelectorAll(): FakeElement[] {
    return this.children.flatMap(c => [
      ...((c.tag === 'button' && !c.disabled) || (c.tag === 'a' && c.href) || c.tabIndex >= 0 ? [c] : []),
      ...c.querySelectorAll(),
    ]);
  }
}

class FakeDocument {
  all: FakeElement[] = [];
  body = this.createElement('body');
  activeElement = this.body;
  listeners = new Map<string, Set<EventListener>>();
  createElement(tag: string) { const e = new FakeElement(tag, this); this.all.push(e); return e; }
  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: EventListener) { this.listeners.get(type)?.delete(listener); }
  key(key: string, shiftKey = false) {
    let stopped = false;
    const event = { key, shiftKey, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { stopped = true; } };
    for (const listener of [...this.listeners.get('keydown') ?? []]) {
      listener(event as unknown as Event);
      if (stopped) break;
    }
  }
}

export function fakeDocument() {
  const fake = new FakeDocument();
  return {
    fake, doc: fake as unknown as Document,
    byId: (id: string) => [...fake.all].reverse().find(e => e.isConnected && e.attrs['data-id'] === id)!,
    tags: (tag: string) => fake.all.filter(e => e.isConnected && e.tag === tag),
  };
}
