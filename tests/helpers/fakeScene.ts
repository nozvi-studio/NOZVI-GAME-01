import type Phaser from 'phaser';
import { vi } from 'vitest';

export type FakeCall = {
  owner: number;
  kind: string;
  method: string;
  args: unknown[];
  depth: number;
  color: number | null;
};

export type FakeObject = Record<string, unknown> & { __id: number; __kind: string; __depth: number };

/**
 * Scene giả: mọi GameObject là Proxy ghi lại lời gọi kèm depth và màu tô hiện
 * tại. Thuộc tính số (x, y, alpha, scale…) đọc/ghi như object thường.
 */
export function createFakeScene() {
  const calls: FakeCall[] = [];
  const objects: FakeObject[] = [];
  let nextId = 0;

  const make = (kind: string): FakeObject => {
    const store: Record<string, unknown> = {
      __id: nextId++,
      __kind: kind,
      __depth: 0,
      __color: null,
      x: 0,
      y: 0,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      visible: true,
    };
    const proxy: FakeObject = new Proxy(store, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'symbol') return undefined;
        if (prop in target) return target[prop];
        return (...args: unknown[]) => {
          if (prop === 'setDepth') target.__depth = args[0];
          if (prop === 'fillStyle') target.__color = args[0];
          if (prop === 'setAlpha') target.alpha = args[0];
          if (prop === 'setVisible') target.visible = args[0];
          if (prop === 'setPosition') {
            target.x = args[0];
            target.y = args[1] ?? args[0];
          }
          calls.push({
            owner: target.__id as number,
            kind,
            method: prop,
            args,
            depth: target.__depth as number,
            color: target.__color as number | null,
          });
          return proxy;
        };
      },
      set(target, prop: string, value) {
        target[prop] = value;
        return true;
      },
    }) as FakeObject;
    objects.push(proxy);
    return proxy;
  };

  const scene = {
    add: {
      graphics: () => make('graphics'),
      image: () => make('image'),
      container: () => make('container'),
      circle: () => make('circle'),
    },
    make: { graphics: () => make('graphics') },
    textures: { exists: () => false, remove: () => {} },
  } as unknown as Phaser.Scene;

  return { scene, calls, objects };
}

/** Nguồn texture giả luôn sẵn sàng, cho test renderer */
export const readyTextures = {
  keys: (pieceId: string, turns: number) => ({
    body: `b:${pieceId}:${turns}`,
    shadow: `s:${pieceId}:${turns}`,
    light: `l:${pieceId}:${turns}`,
    resolution: 1,
  }),
  ensure: (pieceId: string, turns: number) => readyTextures.keys(pieceId, turns),
};

export type Item = {
  kind: string; x: number; y: number; width: number; height: number; depth: number;
  text?: string; style?: Record<string, unknown>; interactive: boolean; destroyed: boolean;
  children: Item[]; handlers: Map<string, (...args: any[]) => void>;
};

/** Only the Phaser display/input boundary is faked; dialogs and persistence run unchanged. */
export function fakeScene(registry: Record<string, unknown>) {
  const items: Item[] = [];
  const make = (kind: string, x = 0, y = 0, width = 0, height = 0, text?: string, style?: Record<string, unknown>) => {
    const item: Item = { kind, x, y, width, height, depth: 0, text, style, interactive: false, destroyed: false, children: [], handlers: new Map() };
    const proxy = new Proxy(item, {
      get(target, key) {
        if (key in target) return target[key as keyof Item];
        return (...args: any[]) => {
          if (key === 'on') target.handlers.set(args[0], args[1]);
          if (key === 'add') target.children.push(...(Array.isArray(args[0]) ? args[0] : [args[0]]));
          if (key === 'setText') target.text = args[0];
          if (key === 'setDepth') target.depth = args[0];
          if (key === 'setInteractive') target.interactive = true;
          if (key === 'disableInteractive') target.interactive = false;
          if (key === 'destroy') target.destroyed = true;
          if (key === 'setDisplaySize' || key === 'setSize') [target.width, target.height] = args;
          return proxy;
        };
      },
    });
    items.push(proxy);
    return proxy;
  };
  const restart = vi.fn();
  const scene = {
    scale: { width: 1080, height: 2460 },
    add: {
      container: (x: number, y: number) => make('container', x, y),
      rectangle: (x: number, y: number, w: number, h: number) => make('rectangle', x, y, w, h),
      zone: (x: number, y: number, w: number, h: number) => make('zone', x, y, w, h),
      image: (x: number, y: number) => make('image', x, y, 24, 24),
      graphics: () => make('graphics'),
      text: (x: number, y: number, text: string, style: Record<string, unknown>) => make('text', x, y, text.length * 12, 30, text, style),
    },
    tweens: { add: (config: { onComplete?: () => void }) => config.onComplete?.() },
    scene: { restart },
    registry: { get: (key: string) => registry[key] },
  } as unknown as Phaser.Scene;
  const hit = (parent: Item, x: number, y: number): Item | undefined => {
    if (parent.destroyed) return;
    for (const child of [...parent.children].reverse()) {
      const found = hit(child, x - child.x, y - child.y);
      if (found) return found;
    }
    if (parent.interactive && Math.abs(x) <= parent.width / 2 && Math.abs(y) <= parent.height / 2) return parent;
  };
  const root = () => items.find(i => i.kind === 'container')!;
  const pointer = { id: 1 };
  const send = (event: string, x: number, y: number, id = 1) => {
    const children = new Set(items.flatMap((i) => i.children));
    const roots = items.filter((i) => i.kind === 'container' && !children.has(i)).sort((a, b) => b.depth - a.depth);
    const item = roots.map((i) => hit(i, x, y)).find(Boolean);
    item?.handlers.get(event)?.({ ...pointer, id }, 0, 0, { stopPropagation() {} });
  };
  const tap = (x: number, y: number) => { send('pointerdown', x, y); send('pointerup', x, y); };
  return { scene, items, root, send, tap, restart };
}
