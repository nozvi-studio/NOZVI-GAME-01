import type Phaser from 'phaser';
import type { MusicPort } from '../audio/music.ts';
import { isReducedMotion } from './motion.ts';
import { TransitionTimeline } from './TransitionTimeline.ts';

export type TransitionContext<K extends string, R extends string> = {
  from: K | 'boot';
  route: R;
  /** Nút hoặc node vừa bấm, để cảnh mới mọc ra từ đúng chỗ đó */
  origin?: { x: number; y: number };
};

export interface Choreographed<K extends string, R extends string> {
  readonly directorKey: K;
  playIn(tl: TransitionTimeline, ctx: TransitionContext<K, R>): void;
  playOut(tl: TransitionTimeline, ctx: TransitionContext<K, R>): void;
}

/** Cổng tới Phaser; test dùng bản giả. */
export interface SceneHost<K extends string, M extends string> {
  start(key: K, data: object): void;
  restart(key: K, data: object): void;
  stop(key: K): void;
  setInputEnabled(key: K, enabled: boolean): void;
  setCameraAlpha(key: K, alpha: number): void;
  setMood(mood: M, durationMs: number): void;
  armSkip(onSkip: () => void): void;
  disarmSkip(): void;
  onStep(cb: (deltaMs: number) => void): void;
}

/** Everything the director needs to know about a particular game. */
export type DirectorConfig<K extends string, R extends string, M extends string> = {
  /** Sky mood each route settles into */
  routeMood: Readonly<Record<R, M>>;
  /** Route used for the in-half when the game starts straight into a scene */
  bootRoute: Readonly<Record<K, R>>;
  /** Music track for a scene */
  trackFor(scene: K): string;
  timing: {
    crossfadeMs: number;
    moodMs: number;
    handoffMs(route: R): number;
    sceneSwapFadeMs: number;
    sceneSwapGapMs: number;
    bootFadeMs: number;
  };
};

export class SceneDirector<K extends string, R extends string, M extends string> {
  private readonly config: DirectorConfig<K, R, M>;
  private host: SceneHost<K, M> | null = null;
  private music: Pick<MusicPort, 'setTrack'> | null = null;
  private busy = false;
  private skipping = false;
  private fromKey: K | null = null;
  private toKey: K | null = null;
  private outTl: TransitionTimeline | null = null;
  private inTl: TransitionTimeline | null = null;
  private incoming: { key: K; ctx: TransitionContext<K, R> } | null = null;
  private outDone = false;
  private inDone = false;
  private pendingEnable: K | null = null;

  constructor(config: DirectorConfig<K, R, M>) {
    this.config = config;
  }

  setHost(host: SceneHost<K, M>): void {
    this.host = host;
    host.onStep((dt) => this.step(dt));
  }

  setMusic(music: Pick<MusicPort, 'setTrack'>): void {
    this.music = music;
  }

  isTransitioning(): boolean {
    return this.busy;
  }

  go(
    fromScene: Choreographed<K, R>,
    to: K,
    data: object,
    ctx: { route: R; origin?: { x: number; y: number } }
  ): boolean {
    const host = this.host;
    if (!host || this.busy) return false;
    const timing = this.config.timing;

    // Music leaves, rests, then returns, independent of reduced motion (spec G §3.6, §3.7)
    this.music?.setTrack(this.config.trackFor(to), timing.sceneSwapFadeMs, timing.sceneSwapGapMs);

    const fromKey = fromScene.directorKey;
    const fullCtx: TransitionContext<K, R> = { ...ctx, from: fromKey };
    const reduced = isReducedMotion();
    this.begin(fromKey, to);
    host.setInputEnabled(fromKey, false);
    host.setMood(this.config.routeMood[ctx.route], reduced ? 0 : timing.moodMs);

    const out = new TransitionTimeline(0);
    this.outTl = out;
    if (reduced) {
      const fade = { alpha: 1 };
      out.at(0, fade, { alpha: 0 }, timing.crossfadeMs, 'linear', () => host.setCameraAlpha(fromKey, fade.alpha));
    } else {
      fromScene.playOut(out, fullCtx);
    }

    this.incoming = { key: to, ctx: fullCtx };
    if (fromKey === to) {
      // Cùng scene (màn kế): đợi phần ra xong rồi mới dựng lại
      out.onDone(() => {
        this.outDone = true;
        host.restart(to, data);
      });
    } else {
      const handoff = reduced ? 0 : timing.handoffMs(ctx.route);
      out.call(handoff, () => host.start(to, data));
      out.onDone(() => {
        this.outDone = true;
        this.maybeFinish();
      });
    }
    out.advance(0);
    return true;
  }

  /** Khởi động thẳng vào một cảnh: chỉ có phần vào. */
  boot(to: K, data: object): void {
    const host = this.host;
    if (!host || this.busy) return;
    this.music?.setTrack(this.config.trackFor(to), this.config.timing.bootFadeMs);
    const route = this.config.bootRoute[to];
    this.begin(null, to);
    this.outDone = true;
    host.setMood(this.config.routeMood[route], 0);
    this.incoming = { key: to, ctx: { from: 'boot', route } };
    host.start(to, data);
  }

  /** Mỗi scene gọi ở cuối create(). Ngoài chuyển cảnh thì không làm gì. */
  attach(scene: Choreographed<K, R>): void {
    const host = this.host;
    const incoming = this.incoming;
    if (!host || !incoming || incoming.key !== scene.directorKey) return;
    this.incoming = null;
    host.setInputEnabled(incoming.key, false);
    const timing = this.config.timing;

    const reduced = isReducedMotion();
    const tl = new TransitionTimeline(reduced ? 0 : timing.handoffMs(incoming.ctx.route));
    this.inTl = tl;
    if (reduced) {
      const fade = { alpha: 0 };
      host.setCameraAlpha(incoming.key, 0);
      tl.at(0, fade, { alpha: 1 }, timing.crossfadeMs, 'linear', () => host.setCameraAlpha(incoming.key, fade.alpha));
    } else {
      scene.playIn(tl, incoming.ctx);
    }
    tl.onDone(() => {
      this.inDone = true;
      this.maybeFinish();
    });
    if (this.skipping) tl.complete();
    else tl.advance(0);
  }

  skip(): void {
    if (!this.busy) return;
    this.skipping = true;
    this.outTl?.complete();
    this.inTl?.complete();
  }

  private begin(fromKey: K | null, toKey: K): void {
    this.busy = true;
    this.skipping = false;
    this.fromKey = fromKey;
    this.toKey = toKey;
    this.outDone = false;
    this.inDone = false;
    this.outTl = null;
    this.inTl = null;
    this.host?.armSkip(() => this.skip());
  }

  private step(dt: number): void {
    if (this.pendingEnable && this.host) {
      this.host.setInputEnabled(this.pendingEnable, true);
      this.pendingEnable = null;
    }
    this.outTl?.advance(dt);
    this.inTl?.advance(dt);
  }

  private maybeFinish(): void {
    const host = this.host;
    if (!host || !this.busy || !this.outDone || !this.inDone) return;
    if (this.fromKey && this.fromKey !== this.toKey) {
      host.setCameraAlpha(this.fromKey, 1);
      host.stop(this.fromKey);
    }
    // Mở input ở khung sau: chạm vừa dùng để bỏ qua không được rơi xuống cảnh mới
    this.pendingEnable = this.toKey;
    host.disarmSkip();
    this.busy = false;
    this.skipping = false;
    this.outTl = null;
    this.inTl = null;
    this.fromKey = null;
    this.toKey = null;
  }
}

/** Chờ chừng này sau khi bắt đầu chuyển mới nhận chạm bỏ qua (tránh chính cú chạm khởi động) */
const SKIP_ARM_GUARD_MS = 80;

/** What the sky scene exposes so the director can change its mood. */
type MoodTarget<M extends string> = { setMood(mood: M, durationMs: number): void };

export class PhaserSceneHost<K extends string, M extends string> implements SceneHost<K, M> {
  private readonly game: Phaser.Game;
  private readonly moodSceneKey: string;
  private skipHandler: (() => void) | null = null;

  constructor(game: Phaser.Game, moodSceneKey: string) {
    this.game = game;
    this.moodSceneKey = moodSceneKey;
  }

  start(key: K, data: object): void {
    this.game.scene.start(key, data);
    this.game.scene.bringToTop(key);
  }

  restart(key: K, data: object): void {
    this.game.scene.getScene(key)?.scene.restart(data);
  }

  stop(key: K): void {
    this.game.scene.stop(key);
  }

  setInputEnabled(key: K, enabled: boolean): void {
    const scene = this.game.scene.getScene(key);
    if (scene?.input) scene.input.enabled = enabled;
  }

  setCameraAlpha(key: K, alpha: number): void {
    this.game.scene.getScene(key)?.cameras?.main?.setAlpha(alpha);
  }

  setMood(mood: M, durationMs: number): void {
    const background = this.game.scene.getScene(this.moodSceneKey) as unknown as MoodTarget<M> | null;
    background?.setMood(mood, durationMs);
  }

  armSkip(onSkip: () => void): void {
    this.disarmSkip();
    const armedAt = performance.now();
    this.skipHandler = () => {
      if (performance.now() - armedAt >= SKIP_ARM_GUARD_MS) onSkip();
    };
    this.game.canvas.addEventListener('pointerdown', this.skipHandler);
  }

  disarmSkip(): void {
    if (this.skipHandler) this.game.canvas.removeEventListener('pointerdown', this.skipHandler);
    this.skipHandler = null;
  }

  onStep(cb: (deltaMs: number) => void): void {
    this.game.events.on('step', (_time: number, delta: number) => cb(delta));
  }
}
