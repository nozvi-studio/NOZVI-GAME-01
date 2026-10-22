import type Phaser from 'phaser';

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
