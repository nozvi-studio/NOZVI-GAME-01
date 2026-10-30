import { afterEach, describe, expect, test } from 'vitest';
import { createDirector } from '../src/presentation/transitions/director.ts';
import type {
  Choreographed,
  Director,
  SceneHost,
  SceneKey,
  TransitionContext,
} from '../src/presentation/transitions/director.ts';
import type { TransitionTimeline } from '../src/engine/core/transitions/TransitionTimeline.ts';
import { setMotionScale } from '../src/presentation/transitions/motion.ts';
import type { SkyMood } from '../src/presentation/sky/skyMood.ts';

afterEach(() => setMotionScale(1));

class FakeScene implements Choreographed {
  readonly directorKey: SceneKey;
  readonly ins: TransitionContext[] = [];
  readonly outs: TransitionContext[] = [];
  readonly probe = { v: 0 };
  private readonly director: Director;

  constructor(key: SceneKey, director: Director) {
    this.directorKey = key;
    this.director = director;
  }

  create(): void {
    this.director.attach(this);
  }

  playIn(tl: TransitionTimeline, ctx: TransitionContext): void {
    this.ins.push(ctx);
    tl.at(1000, this.probe, { v: 1 }, 0, 'linear');
  }

  playOut(tl: TransitionTimeline, ctx: TransitionContext): void {
    this.outs.push(ctx);
    tl.at(0, this.probe, { v: -1 }, 450, 'linear');
  }
}

class FakeHost implements SceneHost {
  readonly log: string[] = [];
  readonly input: Partial<Record<SceneKey, boolean>> = {};
  readonly alpha: Partial<Record<SceneKey, number>> = {};
  readonly moods: Array<[SkyMood, number]> = [];
  skipArmed: (() => void) | null = null;
  scenes: Partial<Record<SceneKey, FakeScene>> = {};
  private stepCb: ((dt: number) => void) | null = null;
  private queue: Array<() => void> = [];

  start(key: SceneKey): void {
    this.log.push(`start:${key}`);
    this.queue.push(() => this.scenes[key]!.create());
  }
  restart(key: SceneKey): void {
    this.log.push(`restart:${key}`);
    this.queue.push(() => this.scenes[key]!.create());
  }
  stop(key: SceneKey): void {
    this.log.push(`stop:${key}`);
  }
  setInputEnabled(key: SceneKey, enabled: boolean): void {
    this.input[key] = enabled;
  }
  setCameraAlpha(key: SceneKey, alpha: number): void {
    this.alpha[key] = alpha;
  }
  setMood(mood: SkyMood, durationMs: number): void {
    this.moods.push([mood, durationMs]);
  }
  armSkip(onSkip: () => void): void {
    this.skipArmed = onSkip;
  }
  disarmSkip(): void {
    this.skipArmed = null;
  }
  onStep(cb: (dt: number) => void): void {
    this.stepCb = cb;
  }
  /** Giống Phaser: hàng đợi scene xử lý đầu khung, rồi tới sự kiện step */
  tick(dt: number): void {
    const queued = this.queue;
    this.queue = [];
    queued.forEach((run) => run());
    this.stepCb?.(dt);
  }
  run(ms: number, dt = 50): void {
    for (let t = 0; t < ms; t += dt) this.tick(dt);
  }
}

function setup() {
  const director = createDirector();
  const host = new FakeHost();
  const menu = new FakeScene('MenuScene', director);
  const play = new FakeScene('PlayScene', director);
  host.scenes = { MenuScene: menu, PlayScene: play };
  director.setHost(host);
  return { director, host, menu, play };
}

describe('SceneDirector', () => {
  test('khoá input, chạy cảnh đích ở mốc handoff, dừng cảnh nguồn, mở input ở khung sau', () => {
    const { director, host, menu, play } = setup();
    expect(director.go(menu, 'PlayScene', { levelId: '1-1' }, { route: 'menu-to-play' })).toBe(true);
    expect(host.input.MenuScene).toBe(false);
    expect(host.skipArmed).not.toBeNull();
    expect(host.moods).toEqual([['play', 1000]]);

    host.tick(150);
    expect(host.log).toEqual([]);
    host.tick(50); // mốc 200 = handoff
    expect(host.log).toEqual(['start:PlayScene']);
    host.tick(16); // hàng đợi: PlayScene.create -> attach
    expect(play.ins).toEqual([{ from: 'MenuScene', route: 'menu-to-play' }]);
    expect(host.input.PlayScene).toBe(false);

    host.run(1400);
    expect(host.log).toEqual(['start:PlayScene', 'stop:MenuScene']);
    expect(host.skipArmed).toBeNull();
    expect(director.isTransitioning()).toBe(false);
    host.tick(16);
    expect(host.input.PlayScene).toBe(true);
  });

  test('đang chuyển thì go trả false (chống bấm hai lần)', () => {
    const { director, menu } = setup();
    expect(director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' })).toBe(true);
    expect(director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' })).toBe(false);
  });

  test('skip trước handoff: cảnh đích vẫn được chạy và lên ngay trạng thái cuối', () => {
    const { director, host, menu, play } = setup();
    director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' });
    host.tick(16);
    director.skip();
    expect(menu.probe.v).toBe(-1);
    expect(host.log).toEqual(['start:PlayScene']);
    host.tick(16);
    expect(play.probe.v).toBe(1);
    expect(host.log).toEqual(['start:PlayScene', 'stop:MenuScene']);
    expect(director.isTransitioning()).toBe(false);
  });

  test('next-level: restart sau khi phần ra xong, không stop', () => {
    const { director, host, play } = setup();
    director.go(play, 'PlayScene', { levelId: '1-2' }, { route: 'next-level' });
    host.run(400); // phần ra giả dài 450 ms
    expect(host.log).toEqual([]);
    host.run(100);
    expect(host.log).toEqual(['restart:PlayScene']);
    host.run(1000);
    expect(host.log).toEqual(['restart:PlayScene']);
    expect(director.isTransitioning()).toBe(false);
  });

  test('Giảm chuyển động: không gọi playOut/playIn, mờ chéo camera 150 ms, mood tức thời', () => {
    setMotionScale(0);
    const { director, host, menu, play } = setup();
    director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' });
    expect(menu.outs).toEqual([]);
    expect(host.moods).toEqual([['play', 0]]);
    expect(host.log).toEqual(['start:PlayScene']);
    host.tick(16);
    expect(play.ins).toEqual([]);
    expect(host.alpha.PlayScene).toBeLessThan(0.2); // đặt 0 lúc attach, rồi tiến 16/150
    host.run(200);
    expect(host.alpha.PlayScene).toBe(1);
    expect(host.alpha.MenuScene).toBe(1); // trả alpha trước khi stop
    expect(host.log).toEqual(['start:PlayScene', 'stop:MenuScene']);
  });

  test('boot chỉ có phần vào, ctx.from là boot', () => {
    const { director, host, play } = setup();
    director.boot('PlayScene', { levelId: '1-3' });
    expect(host.log).toEqual(['start:PlayScene']);
    host.tick(16);
    expect(play.ins[0].from).toBe('boot');
    host.run(1500);
    expect(director.isTransitioning()).toBe(false);
    expect(host.log).toEqual(['start:PlayScene']);
  });

  test('attach ngoài chuyển cảnh không làm gì', () => {
    const { director, host, menu } = setup();
    director.attach(menu);
    expect(menu.ins).toEqual([]);
    expect(host.input.MenuScene).toBeUndefined();
  });
});

describe('music follows the scene', () => {
  test('boot uses the boot fade; go fades out, rests, then fades in', () => {
    const { director, host, menu } = setup();
    const calls: Array<[string | null, number, number | undefined]> = [];
    director.setMusic({ setTrack: (id, ms, gap) => calls.push([id, ms, gap]) });
    director.boot('MenuScene', {});
    host.run(2000);
    director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' });
    expect(calls).toEqual([
      ['music-sky', 1000, undefined],
      ['music-stele', 700, 600],
    ]);
  });

  test('a refused go leaves the music alone', () => {
    const { director, menu } = setup();
    const calls: unknown[] = [];
    director.setMusic({ setTrack: (...args) => calls.push(args) });
    director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' });
    director.go(menu, 'PlayScene', {}, { route: 'menu-to-play' });
    expect(calls).toHaveLength(1);
  });
});
