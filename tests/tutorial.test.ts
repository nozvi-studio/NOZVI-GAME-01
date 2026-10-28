import { describe, expect, it } from 'vitest';
import {
  TUTORIAL_STORAGE_KEY,
  createTutorial,
  createTutorialSeenStore,
  tutorialStorageKey,
} from '../src/application/tutorial.ts';
import type { TutorialAction, TutorialObserved } from '../src/application/tutorial.ts';
import type { StoragePort } from '../src/application/progressPort.ts';

function memoryStorage(initial: Record<string, string> = {}): StoragePort & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStorage: StoragePort = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('full');
  },
};

const observed = (
  o: { selected?: string | null; turns?: Record<string, number>; correct?: string[] } = {}
): TutorialObserved => ({
  selectedPieceId: o.selected ?? null,
  turns: o.turns ?? {},
  correct: new Set(o.correct ?? []),
});

const press = (pieceId: string): TutorialAction => ({ type: 'press-piece', pieceId });
const button: TutorialAction = { type: 'rotate-button' };
const gesture: TutorialAction = { type: 'rotate-gesture' };
const hud: TutorialAction = { type: 'hud' };

describe('createTutorialSeenStore', () => {
  it('starts unseen and remembers markSeen in storage', () => {
    const storage = memoryStorage();
    const store = createTutorialSeenStore(storage);
    expect(store.isSeen()).toBe(false);
    store.markSeen();
    expect(store.isSeen()).toBe(true);
    expect(storage.data[TUTORIAL_STORAGE_KEY]).toBe('1');
  });

  it('reads an existing flag', () => {
    expect(createTutorialSeenStore(memoryStorage({ [TUTORIAL_STORAGE_KEY]: '1' })).isSeen()).toBe(true);
  });

  it('treats a corrupt value as unseen', () => {
    expect(createTutorialSeenStore(memoryStorage({ [TUTORIAL_STORAGE_KEY]: 'banana' })).isSeen()).toBe(false);
  });

  it('survives a throwing storage and keeps the flag in memory', () => {
    const store = createTutorialSeenStore(throwingStorage);
    expect(store.isSeen()).toBe(false);
    expect(() => store.markSeen()).not.toThrow();
    expect(store.isSeen()).toBe(true);
  });

  it('keeps the original key for 1-1 and a per-level key for every other level', () => {
    expect(tutorialStorageKey('1-1')).toBe(TUTORIAL_STORAGE_KEY);
    expect(tutorialStorageKey('3-1')).toBe(`${TUTORIAL_STORAGE_KEY}.3-1`);
  });

  it('keeps one flag per level', () => {
    const storage = memoryStorage();
    createTutorialSeenStore(storage, '3-1').markSeen();
    expect(createTutorialSeenStore(storage, '3-1').isSeen()).toBe(true);
    expect(createTutorialSeenStore(storage, '1-1').isSeen()).toBe(false);
  });
});

describe('createTutorial', () => {
  const pieceIds = ['D1', 'D2'];
  const fresh = () => createTutorialSeenStore(memoryStorage());
  const rotation = {
    pieceIds: ['T1', 'S1'],
    targets: [
      { pieceId: 'T1', turns: 1 },
      { pieceId: 'S1', turns: 0 },
    ],
  };

  it('exists only for levels 1-1 and 3-1 in campaign or harness mode', () => {
    expect(createTutorial({ levelId: '1-1', mode: 'campaign', pieceIds, store: fresh() })).not.toBeNull();
    expect(createTutorial({ levelId: '1-1', mode: 'harness', pieceIds, store: fresh() })).not.toBeNull();
    expect(createTutorial({ levelId: '1-1', mode: 'endless', pieceIds, store: fresh() })).toBeNull();
    expect(createTutorial({ levelId: '1-2', mode: 'campaign', pieceIds, store: fresh() })).toBeNull();
    expect(createTutorial({ levelId: '3-1', mode: 'campaign', ...rotation, store: fresh() })).not.toBeNull();
    expect(createTutorial({ levelId: '3-1', mode: 'endless', ...rotation, store: fresh() })).toBeNull();
    expect(createTutorial({ levelId: '3-2', mode: 'campaign', ...rotation, store: fresh() })).toBeNull();
  });

  it('needs at least two pieces for 1-1, and T1, S1 and the T1 target turns for 3-1', () => {
    expect(createTutorial({ levelId: '1-1', mode: 'campaign', pieceIds: ['D1'], store: fresh() })).toBeNull();
    expect(createTutorial({ levelId: '3-1', mode: 'campaign', pieceIds: ['T1', 'S1'], store: fresh() })).toBeNull();
    expect(
      createTutorial({ levelId: '3-1', mode: 'campaign', pieceIds: ['T1'], targets: rotation.targets, store: fresh() })
    ).toBeNull();
  });

  it('is skipped once seen, unless forced', () => {
    const store = fresh();
    store.markSeen();
    expect(createTutorial({ levelId: '1-1', mode: 'campaign', pieceIds, store })).toBeNull();
    expect(createTutorial({ levelId: '1-1', mode: 'campaign', pieceIds, store, force: true })).not.toBeNull();
  });
});

describe('TutorialController, level 1-1 (time, then drag twice)', () => {
  const make = () => {
    const storage = memoryStorage();
    const store = createTutorialSeenStore(storage);
    const controller = createTutorial({ levelId: '1-1', mode: 'campaign', pieceIds: ['D1', 'D2'], store })!;
    return { controller, store, storage };
  };
  const acked = () => {
    const made = make();
    made.controller.sync(observed());
    made.controller.onEvent('time-ack');
    return made;
  };

  it('starts with the time and stars step, before anything is dragged', () => {
    expect(make().controller.sync(observed())).toEqual({ step: 1, total: 3, id: 'time', pieceId: 'D1' });
  });

  it('stays on the time step until it is acknowledged', () => {
    const { controller } = make();
    controller.sync(observed());
    expect(controller.sync(observed())?.id).toBe('time');
    controller.onEvent('time-ack');
    expect(controller.sync(observed())).toEqual({ step: 2, total: 3, id: 'drag-first', pieceId: 'D1' });
  });

  it('moves to the last step on the remaining piece once one is at its target', () => {
    const { controller } = acked();
    expect(controller.sync(observed({ correct: ['D1'] }))).toEqual({
      step: 3,
      total: 3,
      id: 'drag-second',
      pieceId: 'D2',
    });
  });

  it('points at the remaining piece even when the player got D2 right first', () => {
    const { controller } = acked();
    expect(controller.sync(observed({ correct: ['D2'] }))).toEqual({
      step: 3,
      total: 3,
      id: 'drag-second',
      pieceId: 'D1',
    });
  });

  it('finishes and marks seen when both pieces are at their targets', () => {
    const { controller, store } = acked();
    expect(controller.sync(observed({ correct: ['D1', 'D2'] }))).toBeNull();
    expect(store.isSeen()).toBe(true);
  });

  it('goes back to the first drag step after a reset, without showing the time step again', () => {
    const { controller } = acked();
    controller.sync(observed({ correct: ['D1'] }));
    expect(controller.sync(observed())).toEqual({ step: 2, total: 3, id: 'drag-first', pieceId: 'D1' });
  });

  it('keeps the first drag step after the acknowledgement', () => {
    const { controller } = acked();
    expect(controller.sync(observed())?.id).toBe('drag-first');
  });

  it('stays finished after skip and marks seen', () => {
    const { controller, store } = make();
    controller.skip();
    expect(store.isSeen()).toBe(true);
    expect(controller.sync(observed())).toBeNull();
  });

  it('locks everything in the time step, including pressing a piece', () => {
    const { controller } = make();
    controller.sync(observed());
    expect(controller.allows(press('D1'))).toBe(false);
    expect(controller.allows(press('D2'))).toBe(false);
    expect(controller.allows(hud)).toBe(false);
    expect(controller.allows(button)).toBe(false);
    expect(controller.allows(gesture)).toBe(false);
  });

  it('locks everything except pressing the step piece in the drag steps', () => {
    const { controller } = acked();
    controller.sync(observed());
    expect(controller.allows(press('D1'))).toBe(true);
    expect(controller.allows(press('D2'))).toBe(false);
    expect(controller.allows(hud)).toBe(false);
    expect(controller.allows(button)).toBe(false);
    expect(controller.allows(gesture)).toBe(false);
  });

  it('accepts a drop only when it is the step piece at its target', () => {
    const { controller } = acked();
    controller.sync(observed());
    expect(controller.acceptsDrop('D1', true)).toBe(true);
    expect(controller.acceptsDrop('D1', false)).toBe(false);
    expect(controller.acceptsDrop('D2', true)).toBe(false);
  });

  it('unlocks everything after skip', () => {
    const { controller } = make();
    controller.sync(observed());
    controller.skip();
    expect(controller.allows(hud)).toBe(true);
    expect(controller.allows(press('D2'))).toBe(true);
  });
});

describe('TutorialController, level 3-1 (strict steps)', () => {
  const make = () => {
    const storage = memoryStorage();
    const store = createTutorialSeenStore(storage, '3-1');
    const controller = createTutorial({
      levelId: '3-1',
      mode: 'campaign',
      pieceIds: ['T1', 'S1'],
      targets: [
        { pieceId: 'T1', turns: 1 },
        { pieceId: 'S1', turns: 0 },
      ],
      store,
    })!;
    return { controller, store, storage };
  };
  const step = (n: number, id: string, pieceId: string) => ({ step: n, total: 6, id, pieceId });
  /** Walk to the stage after the four taught actions. */
  const afterGestures = (c: ReturnType<typeof make>['controller']) => {
    c.sync(observed({ selected: 'T1' }));
    c.onEvent('rotate-button');
    c.sync(observed({ selected: 'T1', turns: { T1: 1 } }));
    c.onEvent('double-tap');
    c.sync(observed({ selected: 'T1', turns: { T1: 2 } }));
    c.onEvent('hold-turn');
  };

  it('starts by asking to select the roof piece', () => {
    expect(make().controller.sync(observed())).toEqual(step(1, 'select', 'T1'));
  });

  it('asks to press the Rotate button once the roof piece is selected', () => {
    expect(make().controller.sync(observed({ selected: 'T1' }))).toEqual(step(2, 'rotate-button', 'T1'));
  });

  it('does not jump ahead when the pose is already right: only the button press moves on', () => {
    const { controller } = make();
    controller.sync(observed({ selected: 'T1' }));
    // A double tap selected and turned the piece to the target pose, but nothing was pressed yet.
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 1 } }))).toEqual(step(2, 'rotate-button', 'T1'));
  });

  it('ignores events that arrive out of turn', () => {
    const { controller } = make();
    controller.sync(observed({ selected: 'T1' }));
    controller.onEvent('double-tap');
    controller.onEvent('hold-turn');
    expect(controller.sync(observed({ selected: 'T1' }))).toEqual(step(2, 'rotate-button', 'T1'));
  });

  it('goes select, button, double tap, hold in order, one event each', () => {
    const { controller } = make();
    expect(controller.sync(observed())).toEqual(step(1, 'select', 'T1'));
    expect(controller.sync(observed({ selected: 'T1' }))).toEqual(step(2, 'rotate-button', 'T1'));
    controller.onEvent('rotate-button');
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 1 } }))).toEqual(step(3, 'double-tap', 'T1'));
    controller.onEvent('hold-turn'); // wrong gesture for this step
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 1 } }))).toEqual(step(3, 'double-tap', 'T1'));
    controller.onEvent('double-tap');
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 2 } }))).toEqual(step(4, 'hold', 'T1'));
    controller.onEvent('hold-turn');
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 3 } }))).toEqual(step(5, 'fix-pose', 'T1'));
  });

  it('never goes back to an earlier taught step', () => {
    const { controller } = make();
    afterGestures(controller);
    expect(controller.sync(observed())).toEqual(step(5, 'fix-pose', 'T1'));
  });

  it('shows fix-pose while the roof is not at its target pose, then drag-turned', () => {
    const { controller } = make();
    afterGestures(controller);
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 3 } }))).toEqual(step(5, 'fix-pose', 'T1'));
    expect(controller.sync(observed({ selected: 'T1', turns: { T1: 1 } }))).toEqual(step(5, 'drag-turned', 'T1'));
  });

  it('asks to place the square only when the roof is at its target place and pose', () => {
    const { controller } = make();
    afterGestures(controller);
    // On the grid but not where the outline is: not correct, keep dragging.
    expect(controller.sync(observed({ turns: { T1: 1 } }))).toEqual(step(5, 'drag-turned', 'T1'));
    expect(controller.sync(observed({ correct: ['T1'], turns: { T1: 1 } }))).toEqual(
      step(6, 'place-last', 'S1')
    );
  });

  it('finishes and marks seen when both pieces are correct', () => {
    const { controller, store } = make();
    afterGestures(controller);
    expect(
      controller.sync(observed({ correct: ['T1', 'S1'], turns: { T1: 1 } }))
    ).toBeNull();
    expect(store.isSeen()).toBe(true);
  });

  it('keeps its own seen flag, separate from 1-1', () => {
    const { controller, storage } = make();
    controller.skip();
    expect(storage.data[tutorialStorageKey('3-1')]).toBe('1');
    expect(storage.data[TUTORIAL_STORAGE_KEY]).toBeUndefined();
    expect(controller.sync(observed())).toBeNull();
  });
});

describe('TutorialController, level 3-1 input lock', () => {
  const make = () =>
    createTutorial({
      levelId: '3-1',
      mode: 'campaign',
      pieceIds: ['T1', 'S1'],
      targets: [
        { pieceId: 'T1', turns: 1 },
        { pieceId: 'S1', turns: 0 },
      ],
      store: createTutorialSeenStore(memoryStorage(), '3-1'),
    })!;

  /** The step the controller is on after these events (mirrors the order of the script). */
  const at = (events: Array<'rotate-button' | 'double-tap' | 'hold-turn'>, o: TutorialObserved) => {
    const c = make();
    c.sync(observed({ selected: 'T1' }));
    events.forEach((e) => c.onEvent(e));
    c.sync(o);
    return c;
  };

  it('is open before the first sync', () => {
    expect(make().allows(hud)).toBe(true);
  });

  it('select: only the roof piece may be pressed', () => {
    const c = make();
    c.sync(observed());
    expect(c.allows(press('T1'))).toBe(true);
    expect(c.allows(press('S1'))).toBe(false);
    expect(c.allows(button)).toBe(false);
    expect(c.allows(gesture)).toBe(false);
    expect(c.allows(hud)).toBe(false);
  });

  it('rotate-button: only the Rotate button (pressing pieces would change the selection)', () => {
    const c = at([], observed({ selected: 'T1' }));
    expect(c.allows(button)).toBe(true);
    expect(c.allows(press('T1'))).toBe(false);
    expect(c.allows(gesture)).toBe(false);
    expect(c.allows(hud)).toBe(false);
  });

  it('double-tap and hold: the roof piece and the gestures, not the button', () => {
    for (const events of [['rotate-button'], ['rotate-button', 'double-tap']] as const) {
      const c = at([...events], observed({ selected: 'T1', turns: { T1: 1 } }));
      expect(c.allows(press('T1'))).toBe(true);
      expect(c.allows(gesture)).toBe(true);
      expect(c.allows(button)).toBe(false);
      expect(c.allows(press('S1'))).toBe(false);
      expect(c.allows(hud)).toBe(false);
    }
  });

  it('fix-pose: the roof piece, the button and the gestures', () => {
    const c = at(['rotate-button', 'double-tap', 'hold-turn'], observed({ selected: 'T1', turns: { T1: 3 } }));
    expect(c.allows(press('T1'))).toBe(true);
    expect(c.allows(button)).toBe(true);
    expect(c.allows(gesture)).toBe(true);
    expect(c.allows(hud)).toBe(false);
  });

  it('drag-turned: only dragging the roof piece', () => {
    const c = at(['rotate-button', 'double-tap', 'hold-turn'], observed({ selected: 'T1', turns: { T1: 1 } }));
    expect(c.allows(press('T1'))).toBe(true);
    expect(c.allows(button)).toBe(false);
    expect(c.allows(gesture)).toBe(false);
    expect(c.allows(press('S1'))).toBe(false);
  });

  it('place-last: only the square', () => {
    const c = at(
      ['rotate-button', 'double-tap', 'hold-turn'],
      observed({ correct: ['T1'], turns: { T1: 1 } })
    );
    expect(c.allows(press('S1'))).toBe(true);
    expect(c.allows(press('T1'))).toBe(false);
    expect(c.allows(button)).toBe(false);
    expect(c.allows(gesture)).toBe(false);
  });

  it('opens up after skip', () => {
    const c = make();
    c.sync(observed());
    c.skip();
    expect(c.allows(hud)).toBe(true);
    expect(c.allows(button)).toBe(true);
  });

  it('keeps a dropped piece only in the last two steps, and only when it is at its target', () => {
    const early = make();
    early.sync(observed());
    expect(early.acceptsDrop('T1', true)).toBe(false); // select
    const taught = at(['rotate-button', 'double-tap', 'hold-turn'], observed({ selected: 'T1', turns: { T1: 1 } }));
    expect(taught.acceptsDrop('T1', true)).toBe(true); // drag-turned
    expect(taught.acceptsDrop('T1', false)).toBe(false);
    expect(taught.acceptsDrop('S1', true)).toBe(false);
    const last = at(['rotate-button', 'double-tap', 'hold-turn'], observed({ correct: ['T1'], turns: { T1: 1 } }));
    expect(last.acceptsDrop('S1', true)).toBe(true); // place-last
    expect(last.acceptsDrop('S1', false)).toBe(false);
  });

  it('is open to drops before the first step is shown', () => {
    expect(make().acceptsDrop('T1', false)).toBe(true);
  });
});
