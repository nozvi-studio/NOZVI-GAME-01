import type Phaser from 'phaser';
import { AUDIO_TOKENS, TRANSITION_TOKENS } from '../designTokens.ts';
import type { MoodTarget, SkyMood } from '../sky/skyMood.ts';
import type { RouteId } from './motion.ts';
import { isReducedMotion } from './motion.ts';
import { TransitionTimeline } from './TransitionTimeline.ts';
import type { MusicPort } from '../../engine/core/audio/music.ts';
import { trackFor } from '../audio/tracks.ts';

export type SceneKey = 'MenuScene' | 'LevelSelectScene' | 'PlayScene';

export type TransitionContext = {
  from: SceneKey | 'boot';
  route: RouteId;
  /** Nút hoặc node vừa bấm, để cảnh mới mọc ra từ đúng chỗ đó */
  origin?: { x: number; y: number };
};

export interface Choreographed {
  readonly directorKey: SceneKey;
  playIn(tl: TransitionTimeline, ctx: TransitionContext): void;
  playOut(tl: TransitionTimeline, ctx: TransitionContext): void;
}

/** Cổng tới Phaser; test dùng bản giả. */
export interface SceneHost {
  start(key: SceneKey, data: object): void;
  restart(key: SceneKey, data: object): void;
  stop(key: SceneKey): void;
  setInputEnabled(key: SceneKey, enabled: boolean): void;
  setCameraAlpha(key: SceneKey, alpha: number): void;
  setMood(mood: SkyMood, durationMs: number): void;
  armSkip(onSkip: () => void): void;
  disarmSkip(): void;
  onStep(cb: (deltaMs: number) => void): void;
}

const ROUTE_MOOD: Record<RouteId, SkyMood> = {
  'menu-to-play': 'play',
  'map-to-play': 'play',
  'next-level': 'play',
  'play-to-map': 'map',
  'play-to-menu': 'menu',
  'menu-to-map': 'map',
  'map-to-menu': 'menu',
};

/** Tuyến dùng cho phần vào khi khởi động thẳng vào một cảnh */
const BOOT_ROUTE: Record<SceneKey, RouteId> = {
  MenuScene: 'play-to-menu',
  LevelSelectScene: 'menu-to-map',
  PlayScene: 'menu-to-play',
};

export class SceneDirector {
  private host: SceneHost | null = null;
  private music: Pick<MusicPort, 'setTrack'> | null = null;
  private busy = false;
  private skipping = false;
  private fromKey: SceneKey | null = null;
  private toKey: SceneKey | null = null;
  private outTl: TransitionTimeline | null = null;
  private inTl: TransitionTimeline | null = null;
  private incoming: { key: SceneKey; ctx: TransitionContext } | null = null;
  private outDone = false;
  private inDone = false;
  private pendingEnable: SceneKey | null = null;

  setHost(host: SceneHost): void {
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
    fromScene: Choreographed,
    to: SceneKey,
    data: object,
    ctx: { route: RouteId; origin?: { x: number; y: number } }
  ): boolean {
    const host = this.host;
    if (!host || this.busy) return false;

    // Music leaves, rests, then returns, independent of reduced motion (spec G §3.6, §3.7)
    this.music?.setTrack(trackFor(to), AUDIO_TOKENS.sceneSwapFadeMs, AUDIO_TOKENS.sceneSwapGapMs);

    const fromKey = fromScene.directorKey;
    const fullCtx: TransitionContext = { ...ctx, from: fromKey };
    const reduced = isReducedMotion();
    this.begin(fromKey, to);
    host.setInputEnabled(fromKey, false);
    host.setMood(ROUTE_MOOD[ctx.route], reduced ? 0 : TRANSITION_TOKENS.moodMs);

    const out = new TransitionTimeline(0);
    this.outTl = out;
    if (reduced) {
      const fade = { alpha: 1 };
      out.at(0, fade, { alpha: 0 }, TRANSITION_TOKENS.crossfadeMs, 'linear', () =>
        host.setCameraAlpha(fromKey, fade.alpha)
      );
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
      const handoff = reduced ? 0 : TRANSITION_TOKENS.routes[ctx.route].handoffMs;
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
  boot(to: SceneKey, data: object): void {
    const host = this.host;
    if (!host || this.busy) return;
    this.music?.setTrack(trackFor(to), AUDIO_TOKENS.bootFadeMs);
    const route = BOOT_ROUTE[to];
    this.begin(null, to);
    this.outDone = true;
    host.setMood(ROUTE_MOOD[route], 0);
    this.incoming = { key: to, ctx: { from: 'boot', route } };
    host.start(to, data);
  }


  /** Mỗi scene gọi ở cuối create(). Ngoài chuyển cảnh thì không làm gì. */
  attach(scene: Choreographed): void {
    const host = this.host;
    const incoming = this.incoming;
    if (!host || !incoming || incoming.key !== scene.directorKey) return;
    this.incoming = null;
    host.setInputEnabled(incoming.key, false);

    const reduced = isReducedMotion();
    const tl = new TransitionTimeline(
      reduced ? 0 : TRANSITION_TOKENS.routes[incoming.ctx.route].handoffMs
    );
    this.inTl = tl;
    if (reduced) {
      const fade = { alpha: 0 };
      host.setCameraAlpha(incoming.key, 0);
      tl.at(0, fade, { alpha: 1 }, TRANSITION_TOKENS.crossfadeMs, 'linear', () =>
        host.setCameraAlpha(incoming.key, fade.alpha)
      );
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

  private begin(fromKey: SceneKey | null, toKey: SceneKey): void {
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

export class PhaserSceneHost implements SceneHost {
  private readonly game: Phaser.Game;
  private skipHandler: (() => void) | null = null;

  constructor(game: Phaser.Game) {
    this.game = game;
  }

  start(key: SceneKey, data: object): void {
    this.game.scene.start(key, data);
    this.game.scene.bringToTop(key);
  }

  restart(key: SceneKey, data: object): void {
    this.game.scene.getScene(key)?.scene.restart(data);
  }

  stop(key: SceneKey): void {
    this.game.scene.stop(key);
  }

  setInputEnabled(key: SceneKey, enabled: boolean): void {
    const scene = this.game.scene.getScene(key);
    if (scene?.input) scene.input.enabled = enabled;
  }

  setCameraAlpha(key: SceneKey, alpha: number): void {
    this.game.scene.getScene(key)?.cameras?.main?.setAlpha(alpha);
  }

  setMood(mood: SkyMood, durationMs: number): void {
    const background = this.game.scene.getScene('BackgroundScene') as unknown as MoodTarget | null;
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

export const director = new SceneDirector();
