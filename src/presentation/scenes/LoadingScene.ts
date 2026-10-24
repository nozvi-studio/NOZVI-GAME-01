import { getSafeStorage, memoryStorage } from '../../infrastructure/safeStorage.ts';
import Phaser from 'phaser';
import { buildFactPool, createFactDeck } from '../../application/factDeck.ts';
import type { FactDeck } from '../../application/factDeck.ts';
import { LoadingProgress } from '../../application/loadingProgress.ts';
import { APP_VERSION } from '../../appVersion.ts';
import { campaignManifest } from '../../content/manifest.ts';
import { createProgressRepository } from '../../infrastructure/progressRepository.ts';
import { AUDIO_REGISTRY_KEY } from '../audio/audioServices.ts';
import { cjkWordWrapCallback } from '../cjkWrap.ts';
import { TYPO_TOKENS } from '../designTokens.ts';
import { applyDesignViewport, designViewBounds } from '../designViewport.ts';
import { preloadGalaxyArtwork } from '../galaxy/GalaxyArtwork.ts';
import { resolveCurrentGalaxyTheme } from '../galaxy/galaxyTheme.ts';
import { initialGalaxyThemeIds } from '../galaxy/initialGalaxyThemeIds.ts';
import { getChapterTagline, getChapterVerses, t } from '../i18n.ts';
import { mulberry32 } from '../sky/starField.ts';
import { isReducedMotion, scaleTiming } from '../transitions/motion.ts';
import { director } from '../transitions/SceneDirector.ts';

// Stays up at least this long even when everything is loaded. The bar then
// runs, hesitates and runs again (see `pacedProgress`), which reads as real work and a smooth game.
const MIN_MS = 2000;
const MAX_MS = 8000;
const HOLD_MS = 250;
const FADE_MS = 300;
const SPIN_MS = 4000;
const NAVY = { r: 14, g: 18, b: 64 };
const TEXTURE_KEYS = ['loading-sky', 'loading-glow', 'loading-bar-fill'] as const;

const JEWEL_FACES: ReadonlyArray<{ points: number[]; alpha: number }> = [
  { points: [80, 18, 80, 58, 50, 88, 10, 88], alpha: 0.55 },
  { points: [80, 18, 150, 88, 110, 88, 80, 58], alpha: 0.28 },
  { points: [150, 88, 80, 158, 80, 118, 110, 88], alpha: 0.16 },
  { points: [80, 158, 10, 88, 50, 88, 80, 118], alpha: 0.38 },
  { points: [80, 58, 110, 88, 80, 118, 50, 88], alpha: 0.22 },
];
const JEWEL_EDGES: ReadonlyArray<{ from: [number, number]; to: [number, number]; color: number }> = [
  { from: [80, 18], to: [150, 88], color: 0x5ad1e0 },
  { from: [150, 88], to: [80, 158], color: 0xe58bff },
  { from: [80, 158], to: [10, 88], color: 0xffb45a },
  { from: [10, 88], to: [80, 18], color: 0xffe9a8 },
  { from: [80, 58], to: [110, 88], color: 0x7fe3ff },
];
const JEWEL_SEAMS: ReadonlyArray<[number, number, number, number]> = [
  [80, 18, 80, 58],
  [150, 88, 110, 88],
  [80, 158, 80, 118],
  [10, 88, 50, 88],
];
const JEWEL_GLINT = [76, 34, 42, 66, 34, 73, 70, 28];

export interface LoadingSceneData {
  onFirstFrame?: () => void | Promise<void>;
  prepareAudio?: () => Promise<void>;
}

export class LoadingScene extends Phaser.Scene {
  private progress!: LoadingProgress;
  private deck: FactDeck | null = null;
  /** Mockup CSS px to design px: sizes and horizontal positions. */
  private k = 1;
  /** Same for vertical positions. The mockup is 844 CSS px tall; the design view is 1280 on 9:16 and taller on long phones. */
  private ky = 1;
  private leaving = false;
  private jewel!: Phaser.GameObjects.Container;
  private jewelShadow!: Phaser.GameObjects.Ellipse;
  private spinClock = 0;
  private barX = 0;
  private barW = 0;
  private barFill!: Phaser.GameObjects.Image;
  private barTip!: Phaser.GameObjects.Graphics;
  private percentText!: Phaser.GameObjects.Text;
  private factText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private swapping = false;
  private visible = false;
  private onFirstFrame?: () => void | Promise<void>;
  private prepareAudioCallback?: () => Promise<void>;

  constructor() {
    super({ key: 'LoadingScene' });
  }

  init(data?: LoadingSceneData): void {
    this.onFirstFrame = data?.onFirstFrame;
    this.prepareAudioCallback = data?.prepareAudio;
  }

  create(): void {
    applyDesignViewport(this);
    const view = designViewBounds(this);
    this.k = view.width / 390;
    this.ky = view.height / 844;
    this.leaving = false;
    this.swapping = false;
    this.visible = false;
    this.spinClock = 0;

    this.progress = new LoadingProgress(
      [
        { id: 'fonts', weight: 1 },
        { id: 'galaxy', weight: 6 },
        { id: 'audio', weight: 2 },
      ],
      { minMs: MIN_MS, maxMs: MAX_MS }
    );
    this.progress.complete('fonts'); // main.ts waits for the web fonts before the game starts

    this.buildBackground(view);
    this.buildWordmark(view);
    this.buildJewel(view);
    this.buildFact(view);
    this.buildBar(view);
    this.buildVersion(view);

    this.input.on('pointerdown', () => this.swapFact());
    this.events.once('shutdown', () => {
      for (const key of TEXTURE_KEYS) if (this.textures.exists(key)) this.textures.remove(key);
    });

    if (!isReducedMotion() && !this.onFirstFrame) this.cameras.main.fadeIn(scaleTiming(400), NAVY.r, NAVY.g, NAVY.b);

    // Schedule real work after first frame has rendered and painted
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      requestAnimationFrame(() => {
        void (async () => {
          const cb = this.onFirstFrame;
          this.onFirstFrame = undefined;
          try {
            await cb?.();
          } catch (err) {
            console.warn('[loading] intro handoff failed', err);
          }
          if (!this.scene.isActive()) return;
          this.visible = true;
          this.startLoading();
          if (this.prepareAudioCallback) {
            this.prepareAudioCallback()
              .then(() => this.progress.complete('audio'))
              .catch((err) => {
                console.warn('[loading] audio prep failed, completing task with fallback', err);
                this.progress.complete('audio');
              });
          } else if (this.registry.has(AUDIO_REGISTRY_KEY)) {
            this.progress.complete('audio');
          }
        })();
      });
    });
  }

  update(_time: number, delta: number): void {
    if (!this.visible) return;
    const state = this.progress.tick(delta);
    this.renderBar(state.percent);
    this.renderJewel(delta);
    if (state.done && !this.leaving) this.leave();
  }

  /** Galaxy art goes through the Phaser loader; progress and failures feed the `galaxy` task. */
  private startLoading(): void {
    const { progress } = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2').read();
    preloadGalaxyArtwork(this, initialGalaxyThemeIds(progress.completed));
    this.load.on('progress', (value: number) => this.progress.report('galaxy', value));
    const retried = new Set<string>();
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (!retried.has(file.key) && typeof file.url === 'string') {
        retried.add(file.key);
        this.load.svg(file.key, file.url);
        return;
      }
      console.warn('[loading] failed to load', file.key);
    });
    this.load.once('complete', () => this.progress.complete('galaxy'));
    // Nothing queued (everything cached) completes immediately; `start` is a no-op safe either way.
    this.load.start();
    if (!this.load.isLoading()) this.progress.complete('galaxy');
  }

  private leave(): void {
    this.leaving = true;
    const go = (): void => {
      this.scene.stop('LoadingScene');
      director.boot('MenuScene', {});
    };
    if (isReducedMotion()) {
      go();
      return;
    }
    this.time.delayedCall(HOLD_MS, () => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
      this.cameras.main.fadeOut(FADE_MS, NAVY.r, NAVY.g, NAVY.b);
    });
  }

  private buildBackground(view: { width: number; height: number }): void {
    const sky = this.textures.createCanvas('loading-sky', 4, 256)!;
    const gradient = sky.context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#121650');
    gradient.addColorStop(1, '#0A0A2A');
    sky.context.fillStyle = gradient;
    sky.context.fillRect(0, 0, 4, 256);
    sky.refresh();
    this.add.image(0, 0, 'loading-sky').setOrigin(0).setDisplaySize(view.width, view.height).setDepth(0);

    const glow = this.textures.createCanvas('loading-glow', 256, 256)!;
    const radial = glow.context.createRadialGradient(128, 128, 0, 128, 128, 128);
    radial.addColorStop(0, 'rgba(255,255,255,0.16)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    glow.context.fillStyle = radial;
    glow.context.fillRect(0, 0, 256, 256);
    glow.refresh();
    this.add.image(195 * this.k, 360 * this.ky, 'loading-glow').setDisplaySize(260 * this.k, 260 * this.k).setDepth(1);
    // The thin ring around the jewel (mockup: r 118, white at 14 %, 1 px)
    this.add.circle(195 * this.k, 360 * this.ky).setStrokeStyle(1 * this.k, 0xffffff, 0.14).setRadius(118 * this.k).setDepth(1);

    const random = mulberry32(7);
    const colors = [0xffffff, 0xcfe6ff, 0xffe8b8];
    for (let i = 0; i < 70; i += 1) {
      const star = this.add
        .circle(random() * view.width, random() * view.height, (0.6 + random() * 0.7) * this.k, colors[i % 3])
        .setAlpha(0.4 + random() * 0.6)
        .setDepth(1);
      if (i % 5 === 0 && !isReducedMotion()) {
        this.tweens.add({ targets: star, alpha: 0.3, duration: 1500 + random() * 1500, yoyo: true, repeat: -1, delay: random() * 2000 });
      }
    }
  }

  private buildWordmark(view: { width: number }): void {
    this.add
      .text(view.width / 2 + 5 * this.k, 138 * this.ky, 'MIRROR', {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: `${30 * this.k}px`,
        fontStyle: 'bold',
        color: '#FFFFFF',
        letterSpacing: 10 * this.k,
      })
      .setOrigin(0.5)
      .setAlpha(0.92)
      .setDepth(2);
  }

  private buildVersion(view: { width: number }): void {
    this.add
      .text(view.width / 2, 817.5 * this.ky, t('loading_version', { version: APP_VERSION }), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${11 * this.k}px`,
        color: '#7F88C2',
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  private buildJewel(view: { width: number }): void {
    const k = this.k;
    const ky = this.ky;
    const toLocal = (points: number[]): number[] => points.map((v, i) => (v - (i % 2 === 0 ? 80 : 88)) * k);

    const pairs = (flat: number[]): Phaser.Types.Math.Vector2Like[] => {
      const out: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
      return out;
    };

    const shape = this.add.graphics();
    for (const face of JEWEL_FACES) {
      shape.fillStyle(0xffffff, face.alpha);
      shape.fillPoints(pairs(toLocal(face.points)), true);
    }
    for (const edge of JEWEL_EDGES) {
      shape.lineStyle(3 * k, edge.color, 0.9);
      const [a, b] = [toLocal(edge.from), toLocal(edge.to)];
      shape.lineBetween(a[0], a[1], b[0], b[1]);
    }
    shape.lineStyle(1.2 * k, 0xffffff, 0.5);
    for (const [x1, y1, x2, y2] of JEWEL_SEAMS) {
      const [a, b] = [toLocal([x1, y1]), toLocal([x2, y2])];
      shape.lineBetween(a[0], a[1], b[0], b[1]);
    }
    shape.fillStyle(0xffffff, 0.75);
    shape.fillPoints(pairs(toLocal(JEWEL_GLINT)), true);

    this.jewel = this.add.container(view.width / 2, 360 * ky, [shape]).setDepth(3);
    this.jewelShadow = this.add.ellipse(view.width / 2, 464 * ky, 96 * k, 12 * k, 0x00000a, 0.5).setDepth(2);

    if (!isReducedMotion()) {
      // Float: ±5 px, 4 s sine (the spin below owns scaleX, so the float uses y only)
      this.tweens.add({
        targets: this.jewel,
        y: this.jewel.y + 5 * k,
        duration: SPIN_MS / 2,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
      this.jewel.y -= 5 * k;
    }
  }

  /** Phaser has no 3D, so the Y-rotation is faked by squeezing scaleX with cos; the shadow narrows with it. */
  private renderJewel(delta: number): void {
    if (isReducedMotion()) return;
    this.spinClock = (this.spinClock + delta) % SPIN_MS;
    const cos = Math.cos((this.spinClock / SPIN_MS) * Math.PI * 2);
    this.jewel.setScale(cos, 1);
    const width = 0.3 + 0.7 * Math.abs(cos);
    this.jewelShadow.setScale(width, 1).setAlpha(0.25 + 0.25 * Math.abs(cos));
  }

  private buildFact(view: { width: number }): void {
    const k = this.k;
    const { progress } = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2').read();
    const maxChapter = resolveCurrentGalaxyTheme(progress.completed).chapter;
    const pool = buildFactPool(maxChapter, getChapterVerses, (chapter) => getChapterTagline(chapter));
    this.deck = pool.length > 0 ? createFactDeck(pool) : null;
    if (!this.deck) return;

    const innerW = view.width - 80 * k;
    this.add
      .text(view.width / 2, 550 * this.ky, t('loading_fact_label'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${12 * k}px`,
        fontStyle: 'bold',
        color: '#AEB6E8',
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.factText = this.add
      .text(view.width / 2, 574 * this.ky, this.deck.next(), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${15 * k}px`,
        color: '#FFFFFF',
        align: 'center',
        lineSpacing: 7 * k,
        wordWrap: { width: innerW, callback: cjkWordWrapCallback(innerW) },
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.hintText = this.add
      .text(view.width / 2, 0, t('loading_tap_hint'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${11 * k}px`,
        color: '#7F88C2',
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    this.placeHint();
  }

  private placeHint(): void {
    if (!this.factText || !this.hintText) return;
    this.hintText.setY(Math.min(675 * this.ky, this.factText.y + this.factText.height + 10 * this.k));
  }

  /** Tap anywhere: cross-fade to the next fact (125 ms out, 125 ms in). A tap never delays leaving. */
  private swapFact(): void {
    if (this.leaving || this.swapping || !this.deck || !this.factText) return;
    const fact = this.factText;
    const next = this.deck.next();
    const apply = (): void => {
      fact.setText(next);
      this.placeHint();
    };
    if (isReducedMotion()) {
      apply();
      return;
    }
    this.swapping = true;
    this.tweens.add({
      targets: [fact, this.hintText],
      alpha: 0,
      duration: 125,
      onComplete: () => {
        apply();
        this.tweens.add({ targets: [fact, this.hintText], alpha: 1, duration: 125, onComplete: () => (this.swapping = false) });
      },
    });
  }

  private buildBar(view: { width: number }): void {
    const k = this.k;
    this.barX = 56 * k;
    this.barW = view.width - 112 * k;
    const y = 700 * this.ky;
    const h = 6 * k;

    const track = this.add.graphics().setDepth(2);
    track.fillStyle(0xffffff, 0.14);
    track.fillRoundedRect(this.barX, y, this.barW, h, 3 * k);

    const fill = this.textures.createCanvas('loading-bar-fill', 256, 6)!;
    const gradient = fill.context.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, '#FFFFFF');
    fill.context.fillStyle = gradient;
    fill.context.fillRect(0, 0, 256, 6);
    fill.refresh();
    this.barFill = this.add.image(this.barX, y, 'loading-bar-fill').setOrigin(0).setDisplaySize(1, h).setDepth(3);

    this.barTip = this.add.graphics().setDepth(4);
    this.barTip.fillStyle(0xffffff, 1);
    const r = 9 * k;
    const inner = r * 0.2;
    this.barTip.fillPoints(
      [
        { x: 0, y: -r }, { x: inner, y: -inner }, { x: r, y: 0 }, { x: inner, y: inner },
        { x: 0, y: r }, { x: -inner, y: inner }, { x: -r, y: 0 }, { x: -inner, y: -inner },
      ],
      true
    );
    this.barTip.setPosition(this.barX, y + h / 2);
    if (!isReducedMotion()) {
      this.tweens.add({ targets: this.barTip, scale: 1.35, angle: 45, alpha: 0.85, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.percentText = this.add
      .text(view.width / 2, y + h + 12 * k, '0%', {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${12 * k}px`,
        fontStyle: 'bold',
        color: '#AEB6E8',
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
  }

  private renderBar(percent: number): void {
    const width = Math.max(this.k * 6, (this.barW * percent) / 100);
    this.barFill.setDisplaySize(width, 6 * this.k);
    this.barTip.setX(this.barX + width);
    this.percentText.setText(`${percent}%`);
  }
}
