import { getSafeStorage, memoryStorage } from '../../infrastructure/safeStorage.ts';
import Phaser from 'phaser';
import type { Level, PieceState, PuzzleState, Transition } from '../../domain/model.ts';
import { loadLevel } from '../../content/catalog.ts';
import { expandEquivalentAnchors } from '../../domain/pieceEquivalence.ts';
import { campaignManifest } from '../../content/manifest.ts';
import {
  getEndlessLevelNumber,
  loadEndlessLevel,
  saveEndlessLevelNumber,
} from '../../content/endless/endlessCatalog.ts';
import { furthestLevelId, nextLevelId } from '../../domain/campaign.ts';
import { createProgressRepository } from '../../infrastructure/progressRepository.ts';
import { PlayController, type PlayViewSnapshot } from '../../application/playController.ts';
import { BoardRenderer } from '../board/BoardRenderer.ts';
import { NO_ASSIST, snapAssistFor, type SnapAssist } from '../board/snapAssist.ts';
import { Hud } from '../hud/Hud.ts';
import { TimeBar } from '../hud/TimeBar.ts';
import { TIME_BAR } from '../hud/timeBarModel.ts';
import { applyDesignViewport, designSafeArea, designViewBounds } from '../designViewport.ts';
import {
  computeLayout,
  pieceCenterCanvas,
  pieceHitbox,
  pieceRadiusPx,
} from '../board/layout.ts';
import type { LayoutMetrics } from '../board/layout.ts';

import { DEPTH_TOKENS, FEEDBACK_TOKENS, TYPO_TOKENS, VICTORY_TOKENS } from '../designTokens.ts';
import { TextureFactory } from '../TextureFactory.ts';

import { PauseDialog } from '../dialogs/PauseDialog.ts';
import { TargetBadge } from '../board/TargetBadge.ts';
import { t, getChapterTagline } from '../i18n.ts';
import { LevelHintLabel } from '../hud/LevelHintLabel.ts';
import { restoredCardModel, resultCardModel } from '../hud/resultCardModel.ts';
import { hintController, hintTextKey } from '../hud/levelHints.ts';
import { TutorialCoach } from '../tutorial/TutorialCoach.ts';
import { tutorialSpot } from '../tutorial/tutorialGeometry.ts';
import { createTutorial, createTutorialSeenStore } from '../../application/tutorial.ts';
import type { TutorialAction, TutorialController } from '../../application/tutorial.ts';
import { snappedCount } from '../feedback/audioCues.ts';
import type { FtueController } from '../../application/ftue.ts';
import { resolveVictoryVerse } from '../hud/hudText.ts';
import { director } from '../transitions/SceneDirector.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { createDoubleTap } from '../board/doubleTap.ts';
import { createHoldRotate } from '../board/holdRotate.ts';
import { IDLE_NUDGE_START, stepIdleNudge, type IdleNudgeState } from '../board/idleNudge.ts';
import type { Choreographed, TransitionContext } from '../transitions/SceneDirector.ts';
import type { TransitionTimeline } from '../transitions/TransitionTimeline.ts';
import { choreographPlayIn, choreographPlayOut, type PlayTransitionView } from '../transitions/playChoreography.ts';

import { PieceTextureCache } from '../board/PieceTextureCache.ts';
import { FeedbackDirector } from '../feedback/FeedbackDirector.ts';
import { feedbackEvents, type FeedbackSubject } from '../feedback/feedbackEvents.ts';
import { createHaptics } from '../../infrastructure/haptics.ts';
import { capacitorHapticsDriver } from '../../infrastructure/capacitorHaptics.ts';
import { Capacitor } from '@capacitor/core';
import type { BackgroundScene } from './BackgroundScene.ts';
import { audioServices } from '../audio/audioServices.ts';
import { chapterOfLevelId, setPcBackground } from '../sky/pcBackground.ts';

export class PlayScene extends Phaser.Scene implements Choreographed {
  readonly directorKey = 'PlayScene' as const;
  private loadFailed = false;
  private level!: Level;
  private mode: 'campaign' | 'harness' | 'endless' = 'campaign';
  private hint: { controller: FtueController; label: LevelHintLabel } | null = null;
  private tutorial: { controller: TutorialController; coach: TutorialCoach } | null = null;
  /** `stepId:pieceId` of the step currently drawn, so the coach is redrawn only when the step changes. */
  private tutorialKey = '';
  private forceTutorial = false;
  private endlessChapter = 1;
  private endlessLevel = 1;
  private controller!: PlayController;
  private boardRenderer!: BoardRenderer;
  private snapAssist: SnapAssist = NO_ASSIST;
  private textureCache!: PieceTextureCache;
  private feedback!: FeedbackDirector;
  private layout!: LayoutMetrics;
  private targetBadge!: TargetBadge;
  private hud!: Hud;
  private timeBar!: TimeBar;
  private pauseDialog!: PauseDialog;
  private previewCompletedThrough?: string;
  private cachedVictoryVerse: string | null = null;
  private idleNudge: IdleNudgeState = IDLE_NUDGE_START;
  /** Set by any pointer event; the next update() consumes it to restart the idle clock. */
  private sawActivity = false;
  private readonly doubleTap = createDoubleTap();
  /** Second press of a double tap held on a piece: turns it, pauses, turns it again. */
  private readonly holdRotate = createHoldRotate();
  /** Where and on which piece the current press began, for double-tap detection. */
  private pressStart: { pieceId: string | null; x: number; y: number } | null = null;

  private getOrResolveVictoryVerse(): string {
    if (this.cachedVictoryVerse !== null) {
      return this.cachedVictoryVerse;
    }
    const searchParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const factParam = searchParams.get('fact');
    this.cachedVictoryVerse = resolveVictoryVerse({
      mode: this.mode,
      levelId: this.level.id,
      endlessChapter: this.endlessChapter,
      fallbackVerse: this.level.victoryVerse,
      overrideFact: factParam,
    });
    return this.cachedVictoryVerse;
  }

  constructor() {
    super({ key: 'PlayScene' });
  }

  init(data: {
    levelId?: string;
    mode?: 'campaign' | 'harness' | 'endless';
    chapter?: number;
    endlessLevel?: number;
    previewCompletedThrough?: string;
    tutorial?: boolean;
  }): void {
    this.forceTutorial = data.tutorial === true;
    this.loadFailed = false;
    this.cachedVictoryVerse = null;
    this.mode = data.mode ?? 'campaign';
    this.previewCompletedThrough = this.mode === 'harness'
      ? data.previewCompletedThrough
      : undefined;

    if (this.mode === 'endless') {
      this.endlessChapter = data.chapter ?? 1;
      this.endlessLevel = data.endlessLevel ?? getEndlessLevelNumber(this.endlessChapter);
      try {
        // Endless levels have no per-level fact, so the win card shows the chapter's cosmic fact.
        this.level = {
          ...loadEndlessLevel(this.endlessChapter, this.endlessLevel),
          victoryVerse: getChapterTagline(this.endlessChapter),
        };
      } catch (err) {
        console.warn(`[PlayScene] Không thể tải màn endless chapter ${this.endlessChapter} level ${this.endlessLevel}:`, err);
        try {
          this.level = loadLevel('1-1', 'campaign');
        } catch {
          this.loadFailed = true;
        }
      }
    } else {
      const levelId = data.levelId ?? '1-1';
      try {
        this.level = loadLevel(levelId, this.mode);
      } catch (err) {
        console.warn(`[PlayScene] Không thể tải màn ${levelId}, tự động chuyển về màn 1-1 an toàn:`, err);
        try {
          this.level = loadLevel('1-1', this.mode);
        } catch (fallbackErr) {
          console.error('[PlayScene] Lỗi nghiêm trọng khi tải màn 1-1:', fallbackErr);
          this.loadFailed = true;
        }
      }
    }
  }

  create(): void {
    setPcBackground(
      this.mode === 'endless' ? this.endlessChapter : chapterOfLevelId(this.level?.id ?? '1-1'),
    );
    if (this.loadFailed) {
      // Không tải được cả 1-1: kết thúc chuyển cảnh đang chờ rồi về Menu
      director.attach(this);
      director.skip();
      this.time.delayedCall(0, () => {
        director.go(this, 'MenuScene', {}, { route: 'play-to-menu' });
      });
      return;
    }

    this.level = expandEquivalentAnchors(this.level);

    this.hint = null;
    this.tutorial = null;
    this.tutorialKey = '';
    applyDesignViewport(this);
    TextureFactory.generateAll(this);
    // Hệ toạ độ thiết kế, không phải kích thước bộ đệm: camera zoom đã quy đổi.
    // Chiều cao chạy theo máy thật nên bố cục dọc giãn ra lấp kín màn hình.
    const view = designViewBounds(this);
    const layout = computeLayout(view.width, view.height, designSafeArea(this));
    this.layout = layout;

    const progressRepo = createProgressRepository(
      getSafeStorage() ?? memoryStorage,
      campaignManifest,
      'oracle-v2'
    );

    const savedProgress = progressRepo.read().progress;
    this.controller = new PlayController(
      this.level,
      progressRepo,
      this.mode === 'campaign',
      true // eye retired: the dashed outline is always on; saved showTarget is ignored
    );

    // Texture mảnh vẽ rải mỗi khung một mảnh trong update(), không vẽ trong
    // create() để handoff của chuyển cảnh F1 không có khung > 50 ms.
    this.textureCache = new PieceTextureCache(this, this.level, layout.cellPixel);
    for (const piece of this.level.pieces) this.textureCache.enqueue(piece.id, 0);
    this.events.once('shutdown', () => this.textureCache.destroy());

    this.snapAssist = snapAssistFor(this.level.id, this.mode);
    this.boardRenderer = new BoardRenderer(this, layout, this.level, this.textureCache, this.snapAssist);
    this.targetBadge = new TargetBadge(this, layout, this.level);

    this.pauseDialog = new PauseDialog(this, {
      onResume: () => {},
      onRestart: () => {
        this.resetLevel();
      },
      onLevelSelect: () => {
        this.openLevelSelect();
      },
      onLanguageChange: () => {},
      audio: {
        isMusicOn: () => progressRepo.read().progress.settings.music,
        isSfxOn: () => progressRepo.read().progress.settings.sfx,
        setMusic: (on) => {
          progressRepo.setMusic(on);
          audioServices(this).music.setEnabled(on);
        },
        setSfx: (on) => {
          progressRepo.setSfx(on);
          audioServices(this).sfx.setEnabled(on);
        },
      },
    });

    this.hud = new Hud(
      this,
      '',
      {
        onMenu: () => {
          if (!this.tutorialAllows({ type: 'hud' })) return;
          this.pauseDialog.open();
        },
        onReset: () => {
          if (!this.tutorialAllows({ type: 'hud' })) return;
          this.resetLevel();
        },
        onRotate: () => {
          if (!this.tutorialAllows({ type: 'rotate-button' })) return;
          const pieceId = this.controller.getSnapshot().selectedPieceId;
          const prev = this.controller.getPuzzleState();
          const transition = this.controller.onRotate();
          this.commit(prev, transition, { command: 'rotate', pieceId });
          if (transition) this.tutorial?.controller.onEvent('rotate-button');
        },
        onToggleTarget: () => {
          if (!this.tutorialAllows({ type: 'hud' })) return;
          this.controller.onToggleTarget();
          this.refreshView();
        },
        onLevelSelect: () => {
          if (!this.tutorialAllows({ type: 'hud' })) return;
          this.openLevelSelect();
        },
        onWinCollapse: (ms) => this.feedback.collapseDust(ms),
        onNextLevel: () => {
          if (this.mode === 'endless') {
            director.go(this, 'PlayScene', {
              mode: 'endless',
              chapter: this.endlessChapter,
              endlessLevel: this.endlessLevel + 1,
            }, { route: 'next-level' });
            return;
          }
          const nextId = nextLevelId(campaignManifest, this.level.id);
          let playable = false;
          if (nextId) {
            try {
              // Kiểm tra đúng chế độ: campaign về menu nếu màn kế chưa approved.
              loadLevel(nextId, this.mode);
              playable = true;
            } catch {
              playable = false;
            }
          }
          if (nextId && playable) {
            director.go(this, 'PlayScene', {
              levelId: nextId,
              mode: this.mode,
              previewCompletedThrough: this.mode === 'harness'
                ? furthestLevelId(campaignManifest, this.previewCompletedThrough, this.level.id)
                : undefined,
            }, { route: 'next-level' });
          } else {
            director.go(this, 'MenuScene', {}, { route: 'play-to-menu' });
          }
        },
      },
      this.level.id,
      layout
    );

    this.timeBar = new TimeBar(this, layout);
    this.events.once('shutdown', () => this.timeBar.destroy());
    if (this.mode === 'campaign') this.hud.setSubtitleY(layout.headerBounds.y + TIME_BAR.subtitleY);

    const haptics = createHaptics(
      Capacitor.isNativePlatform() ? capacitorHapticsDriver() : null,
      () => savedProgress.settings.haptics
    );
    this.feedback = new FeedbackDirector({
      scene: this,
      level: this.level,
      layout,
      board: this.boardRenderer,
      hud: this.hud,
      textures: this.textureCache,
      haptics,
      audio: audioServices(this),
      getState: () => this.controller.getPuzzleState(),
      background: () => this.scene.get('BackgroundScene') as BackgroundScene | null,
      getVictoryVerse: () => this.getOrResolveVictoryVerse(),
    });

    // Pointer events
    // Every pointer event counts as activity (this also covers HUD buttons).
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointerupoutside']) {
      this.input.on(type, () => {
        this.sawActivity = true;
      });
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.feedback.isVictoryRunning()) {
        this.feedback.skipVictory();
        return;
      }
      // Tutorial lock: look before touching. Only the step's own piece may be pressed.
      const under = this.controller.pieceAt(pointer.worldX, pointer.worldY, layout);
      const board = layout.boardBounds;
      const onBoard =
        pointer.worldX >= board.x &&
        pointer.worldX <= board.x + board.width &&
        pointer.worldY >= board.y &&
        pointer.worldY <= board.y + board.height;
      if (!this.tutorialAllows(under ? { type: 'press-piece', pieceId: under } : { type: 'hud' }, under !== null || onBoard)) {
        return;
      }
      const hit = this.controller.onPointerDown(pointer.worldX, pointer.worldY, layout, pointer.wasTouch ? FEEDBACK_TOKENS.fingerLift : 0);
      this.pressStart = {
        pieceId: hit ? this.controller.getSnapshot().dragInfo?.pieceId ?? null : null,
        x: pointer.worldX,
        y: pointer.worldY,
      };
      this.holdRotate.cancel();
      if (hit) {
        const pieceId = this.controller.getSnapshot().dragInfo?.pieceId;
        if (
          pieceId &&
          this.level.rotationEnabled &&
          this.doubleTap.pending(pieceId, this.time.now) &&
          this.tutorialAllows({ type: 'rotate-gesture' })
        ) {
          this.holdRotate.begin(pieceId, pointer.worldX, pointer.worldY, this.time.now);
        }
        if (pieceId) this.feedback.handle([{ type: 'lift', pieceId }]);
        this.refreshView();
      } else {
        this.spawnCosmicInteraction(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.holdRotate.move(pointer.worldX, pointer.worldY);
      this.controller.onPointerMove(pointer.worldX, pointer.worldY, layout);
    });

    const release = (pointer: Phaser.Input.Pointer) => {
      const turnedByHold = this.holdRotate.end();
      const pieceId = this.controller.getSnapshot().dragInfo?.pieceId ?? null;
      const prev = this.controller.getPuzzleState();
      // The second tap of a double tap is about to turn the piece, and the turn has its own sound; the drop
      // under it would sound at the same instant, so it stays quiet.
      const press = this.pressStart;
      const turnsNext =
        !turnedByHold &&
        press !== null &&
        this.level.rotationEnabled &&
        this.doubleTap.wouldComplete(press.pieceId, press, { x: pointer.worldX, y: pointer.worldY }, this.time.now) &&
        this.tutorialAllows({ type: 'rotate-gesture' }, false);
      this.commit(prev, this.controller.onPointerUp(pointer.worldX, pointer.worldY, layout), { command: 'move', pieceId }, turnsNext);
      this.returnWrongDrop(pieceId);
      if (turnedByHold) {
        // The hold already turned the piece: this release is a drop, not a tap.
        this.pressStart = null;
        this.doubleTap.reset();
        return;
      }
      this.rotateOnDoubleTap(pointer);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.input.on('gameout', () => {
      this.holdRotate.cancel();
      const pieceId = this.controller.getSnapshot().dragInfo?.pieceId ?? null;
      const prev = this.controller.getPuzzleState();
      this.commit(prev, this.controller.onPointerCancel(), { command: 'move', pieceId });
    });

    this.refreshView();

    if (this.controller.getSnapshot().phase === 'won') {
      this.boardRenderer.setVictoryMode(true);
      this.feedback.restoreVictoryEnd();
      // The victory timeline deepens the sky at skyDimAtMs; this path has no
      // timeline, so it jumps straight to the same end state. Without it the
      // two routes into the won state leave different screens.
      (this.scene.get('BackgroundScene') as BackgroundScene | null)?.deepen(VICTORY_TOKENS.skyDimExtra, 0);
      this.hud.setResult(restoredCardModel(savedProgress.levels[this.level.id]));
      this.hud.showWinModal(this.getOrResolveVictoryVerse());
    } else {
      // Thông báo banner chào đón đầu màn chơi
      this.showTutorial(layout);
      if (!this.tutorial) {
        this.showLevelStartToast(layout);
        this.showLevelHint(layout);
      }
    }

    // Chỉ dùng khi phát triển: tự kéo mảnh để chụp ảnh kiểm tra thị giác.
    // ?autosolve=win  -> đặt đủ mảnh, ra màn hoàn thành
    // ?autosolve=drag -> mảnh đầu đã khớp, mảnh sau đang được kéo gần đích
    if (import.meta.env.DEV) {
      const mode = new URLSearchParams(window.location.search).get('autosolve');
      if (mode === 'win' || mode === 'drag') this.autosolve(mode, layout);
    }

    director.attach(this);
  }

  update(_time: number, delta: number): void {
    if (this.loadFailed) return;
    this.textureCache.bakeNext();
    this.feedback.tick(delta);
    const snapshot = this.controller.getSnapshot();
    if (!this.pauseDialog.isOpen()) this.controller.tickClock(delta);
    this.timeBar.update(this.controller.getSnapshot().timer);
    this.idleNudge = stepIdleNudge(this.idleNudge, delta, {
      activity: this.sawActivity,
      blocked:
        snapshot.dragInfo !== null ||
        snapshot.phase === 'won' ||
        this.feedback.isVictoryRunning() ||
        this.pauseDialog.isOpen() ||
        isReducedMotion(),
    });
    this.sawActivity = false;
    this.stepHoldRotate(snapshot);
    this.boardRenderer.setIdleNudge(this.idleNudge.active ? this.idleNudge.phase : null, this.idleNudge.beat);
    this.boardRenderer.tick(delta, snapshot, this.controller.getPuzzleState().pieces);
    this.hud.tickSnapHint(delta, this.snapHintTarget(snapshot));
    this.syncTutorial();
  }

  private snapHintTarget(snapshot: PlayViewSnapshot): { x: number; y: number } | null {
    const drag = snapshot.dragInfo;
    if (!this.snapAssist.dropLabel || !drag || !drag.onTarget) return null;
    const piece = this.level.pieces.find((p) => p.id === drag.pieceId);
    const radius = piece ? pieceRadiusPx(piece.frameSize, this.layout) : 120;
    return { x: drag.x + radius * 0.8, y: drag.y + radius * 0.5 };
  }

  /**
   * While the second press of a double tap stays down, turn the piece in hand every step.
   * The drag carries on, so the piece can be moved and turned at the same time.
   */
  private stepHoldRotate(snapshot: PlayViewSnapshot): void {
    if (snapshot.phase === 'won' || this.pauseDialog.isOpen()) {
      this.holdRotate.cancel();
      return;
    }
    if (this.holdRotate.step(this.time.now) === 'none') return;
    if (!this.tutorialAllows({ type: 'rotate-gesture' })) {
      this.holdRotate.cancel();
      return;
    }
    const pieceId = snapshot.dragInfo?.pieceId ?? null;
    const prev = this.controller.getPuzzleState();
    const transition = this.controller.onRotateDuringDrag(this.layout);
    this.commit(prev, transition, { command: 'rotate', pieceId });
    if (transition) this.tutorial?.controller.onEvent('hold-turn');
  }

  /** Double tap on a piece rotates it, through the same path as the rotate button (rotation levels only). */
  private rotateOnDoubleTap(pointer: Phaser.Input.Pointer): void {
    const press = this.pressStart;
    this.pressStart = null;
    if (!press) return;
    const up = { x: pointer.worldX, y: pointer.worldY };
    if (!this.doubleTap.register(press.pieceId, press, up, this.time.now)) return;
    if (!this.tutorialAllows({ type: 'rotate-gesture' })) return;
    const pieceId = this.controller.getSnapshot().selectedPieceId;
    const prev = this.controller.getPuzzleState();
    const transition = this.controller.onRotate();
    this.commit(prev, transition, { command: 'rotate', pieceId });
    if (transition) this.tutorial?.controller.onEvent('double-tap');
  }

  /** Áp kết quả một lệnh: phát phản hồi rồi cập nhật HUD */
  private commit(prev: PuzzleState, transition: Transition | null, subject: FeedbackSubject, silent = false): void {
    if (!transition) return;
    if (transition.becameWon) {
      const result = this.controller.getResult();
      this.hud.setResult(result ? resultCardModel(result) : null);
      this.getOrResolveVictoryVerse();
      if (this.mode === 'endless') {
        saveEndlessLevelNumber(this.endlessChapter, this.endlessLevel + 1);
      }
    }
    this.feedback.handle(feedbackEvents(prev, transition, this.level, subject), { silent });
    this.refreshView();
    this.syncHint();
  }

  /** Gợi ý đầu màn tắt khi có mảnh khớp đầu tiên (hoặc khi thắng) */
  private syncHint(): void {
    if (!this.hint) return;
    const state = this.controller.getPuzzleState();
    if (snappedCount(state) > 0 || state.phase === 'won') this.hint.controller.onAction('snap');
    if (!this.hint.controller.getState().visible) {
      this.hint.label.hide(this);
      this.hint = null;
    }
  }

  /** Dựng ô gợi ý đầu màn nếu màn có (chỉ màn campaign, chưa thắng) */
  private showLevelHint(layout: LayoutMetrics): void {
    if (this.mode !== 'campaign' && this.mode !== 'harness') return;
    const controller = hintController(this.level.id);
    const key = controller ? hintTextKey(controller.getState().stepId) : null;
    if (!controller || !key) return;
    this.hint = { controller, label: new LevelHintLabel(this, layout, t(key)) };
    this.events.once('shutdown', () => this.hint?.label.destroy());
  }

  /** First-visit coach overlay (levels 1-1 and 3-1); waits for the level-start toast to clear before appearing. */
  private showTutorial(layout: LayoutMetrics): void {
    if (this.mode !== 'campaign' && this.mode !== 'harness') return;
    const controller = createTutorial({
      levelId: this.level.id,
      mode: this.mode,
      pieceIds: this.level.pieces.map((p) => p.id),
      targets: (this.level.targetPlacements ?? []).map((p) => ({ pieceId: p.pieceId, turns: p.turns })),
      store: createTutorialSeenStore(getSafeStorage() ?? memoryStorage, this.level.id),
      force: this.forceTutorial,
    });
    if (!controller) return;
    const coach = new TutorialCoach(
      this,
      this.level,
      layout,
      () => this.skipTutorial(),
      () => this.tutorial?.controller.onEvent('time-ack')
    );
    this.tutorial = { controller, coach };
    this.events.once('shutdown', () => {
      this.tutorial?.coach.destroy();
      this.tutorial = null;
    });
    // Locked and drawn from the first frame (the level-start toast is skipped while a tutorial runs).
    this.syncTutorial();
  }

  /**
   * Called every frame: derive the observed state, ask the script for the current step and
   * redraw the coach only when the step (or its piece) changes. Selection, rotation, double tap and
   * hold-rotate all change this state, so no event hooks are needed.
   */
  private syncTutorial(): void {
    const active = this.tutorial;
    if (!active) return;
    const turns: Record<string, number> = {};
    const correct = new Set<string>();
    for (const [id, piece] of Object.entries(this.controller.getPuzzleState().pieces)) {
      turns[id] = piece.turns;
      if (this.isAtTarget(id, piece)) correct.add(id);
    }
    const view = active.controller.sync({
      selectedPieceId: this.controller.getSnapshot().selectedPieceId,
      turns,
      correct,
    });
    const spot = view ? tutorialSpot(this.level, view.pieceId, this.layout) : null;
    if (!view || !spot) {
      if (view) active.controller.skip();
      active.coach.hide();
      this.tutorial = null;
      this.tutorialKey = '';
      return;
    }
    const key = `${view.id}:${view.pieceId}`;
    if (key === this.tutorialKey) return;
    this.tutorialKey = key;
    active.coach.show(view, spot, { rotateButton: this.hud.rotateButtonBounds(), timeBar: this.timeBar.bounds() });
  }

  /**
   * While a tutorial runs, only what the current step teaches is accepted. Open before the coach is armed
   * and after the tutorial ends or is skipped.
   */
  private tutorialAllows(action: TutorialAction, nudge = true): boolean {
    const active = this.tutorial;
    if (!active) return true;
    const ok = active.controller.allows(action);
    // A blocked input is not silent: the coach shakes its card and rings the thing to use.
    if (!ok && nudge) active.coach.nudge();
    return ok;
  }

  /** On the grid at the sample solution's cell and pose (a free-placement drop anywhere else does not count). */
  private isAtTarget(id: string, piece: PieceState): boolean {
    const goal = this.level.targetPlacements?.find((p) => p.pieceId === id);
    return !!goal && piece.kind === 'placed' && piece.x === goal.x && piece.y === goal.y && piece.turns === goal.turns;
  }

  /**
   * Tutorial only: a dropped piece that is not the step's piece on its target goes straight back to the tray,
   * so there is always exactly one thing to do.
   */
  private returnWrongDrop(pieceId: string | null): void {
    const active = this.tutorial;
    if (!active || !pieceId) return;
    const piece = this.controller.getPuzzleState().pieces[pieceId];
    if (!piece || piece.kind === 'tray') return;
    if (active.controller.acceptsDrop(pieceId, this.isAtTarget(pieceId, piece))) return;
    const prev = this.controller.getPuzzleState();
    this.commit(prev, this.controller.onReturnToTray(pieceId), { command: 'move', pieceId });
  }

  private skipTutorial(): void {
    const active = this.tutorial;
    if (!active) return;
    active.controller.skip();
    active.coach.hide();
    this.tutorialKey = '';
    this.tutorial = null;
  }

  private resetLevel(): void {
    const run = () => {
      const prev = this.controller.getPuzzleState();
      this.commit(prev, this.controller.onReset(), { command: 'reset', pieceId: null });
    };
    if (this.controller.getSnapshot().phase === 'won') this.feedback.unwindVictory(run);
    else run();
  }

  private transitionView(): PlayTransitionView {
    const board = this.boardRenderer.getTransitionParts();
    const hud = this.hud.getTransitionParts();
    return {
      scene: this,
      parts: {
        board: board.board,
        runes: board.runes,
        rings: board.rings,
        tray: board.tray,
        trayPieces: board.trayPieces,
        pieces: board.pieces,
        targets: board.targets,
        title: hud.title,
        topButtons: [...hud.topButtons, this.targetBadge.getContainer()],
        bottomBar: hud.bottomBar,
        winCard: hud.winCard,
      },
      grid: board.grid,
      boardBounds: this.layout.boardBounds,
      targetCount: this.level.targetPlacements?.length ?? 0,
      setTargetReveal: (values) => this.boardRenderer.setTargetReveal(values),
      setFrameGold: (on) => this.boardRenderer.setFrameGold(on),
    };
  }

  playIn(tl: TransitionTimeline, ctx: TransitionContext): void {
    if (this.loadFailed) return;
    choreographPlayIn(tl, ctx, this.transitionView());
  }

  playOut(tl: TransitionTimeline, ctx: TransitionContext): void {
    if (this.loadFailed) return;
    choreographPlayOut(tl, ctx, this.transitionView());
  }

  private autosolve(mode: 'win' | 'drag', layout: LayoutMetrics): void {
    const pieces = this.level.pieces;
    pieces.forEach((piece, index) => {
      const start = pieceHitbox(piece, { kind: 'tray', turns: 0 }, layout, index, pieces.length);
      const anchor = piece.anchors.find((a) => a.id === 'A') ?? piece.anchors[0];
      const target = pieceCenterCanvas(piece.frameSize, anchor.x, anchor.y, layout);
      this.controller.onPointerDown(start.x + start.width / 2, start.y + start.height / 2, layout);

      const isLast = index === pieces.length - 1;
      if (mode === 'drag' && isLast) {
        // Dừng giữa chừng, lệch nhẹ khỏi đích để còn trong vùng hít
        this.controller.onPointerMove(target.x + 12, target.y - 12, layout);
        this.refreshView();
        return;
      }

      const prev = this.controller.getPuzzleState();
      const transition = this.controller.onPointerUp(target.x, target.y, layout);
      this.commit(prev, transition, { command: 'move', pieceId: piece.id });
    });
  }

  private refreshView(): void {
    this.hud.update(this.controller.getSnapshot());
    this.timeBar.update(this.controller.getSnapshot().timer);
  }

  private openLevelSelect(): void {
    const justCompleted = this.controller?.getSnapshot().phase === 'won'
      ? this.level.id
      : undefined;
    director.go(this, 'LevelSelectScene', {
      mode: this.mode === 'endless' ? 'campaign' : this.mode,
      previewCompletedThrough: this.mode === 'harness'
        ? furthestLevelId(
            campaignManifest,
            this.previewCompletedThrough,
            justCompleted
          )
        : undefined,
    }, { route: 'play-to-map' });
  }

  public onHardwareBack(): void {
    if (!this.tutorialAllows({ type: 'hud' })) return;
    if (this.pauseDialog.isOpen()) {
      this.pauseDialog.close();
    } else {
      this.pauseDialog.open();
    }
  }

  /**
   * Banner chào đón đầu màn chơi (Level Start Toast)
   * Xuất hiện với hiệu ứng pop-in đàn hồi, giữ 1.25s rồi trôi nhẹ lên trên và biến mất.
   */
  private showLevelStartToast(layout: LayoutMetrics): void {
    const chapterNum = this.mode === 'endless'
      ? String(this.endlessChapter)
      : (this.level.id.split('-')[0] ?? '1');
    const localizedTitle = `${t('gate_endless')} ${this.endlessLevel}`;

    const cx = layout.boardBounds.x + layout.boardBounds.width / 2;
    const cy = layout.boardBounds.y + layout.boardBounds.height * 0.42;

    const toastContainer = this.add.container(cx, cy).setDepth(120);

    const toastW = 380;
    const toastH = 92;

    // Bóng đổ sẫm màu
    const shadow = this.add.graphics();
    shadow.fillStyle(0x050a1a, 0.75);
    shadow.fillRoundedRect(-toastW / 2 + 4, -toastH / 2 + 6, toastW, toastH, 24);

    // Tấm thẻ kính saphire rực rỡ
    const card = this.add.graphics();
    card.fillStyle(0x131b4d, 0.94);
    card.fillRoundedRect(-toastW / 2, -toastH / 2, toastW, toastH, 24);

    // Lớp tráng gương phía trên
    card.fillStyle(0xffffff, 0.12);
    card.fillRoundedRect(-toastW / 2 + 10, -toastH / 2 + 4, toastW - 20, 20, 10);

    // Viền kép ngọc vàng và băng lam
    card.lineStyle(2.5, 0xffd23f, 0.9);
    card.strokeRoundedRect(-toastW / 2, -toastH / 2, toastW, toastH, 24);
    card.lineStyle(1.2, 0x7fd8ff, 0.65);
    card.strokeRoundedRect(-toastW / 2 + 4, -toastH / 2 + 4, toastW - 8, toastH - 8, 20);

    // Dòng trên: Tên chương (CHƯƠNG 1 / CHAPTER 1)
    const chapterText = this.add
      .text(0, -toastH / 2 + 24, `${t('chapter_prefix').toUpperCase()} ${chapterNum}`, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '14px',
        color: '#FFD23F',
        stroke: '#22145A',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Dòng dưới: số màn (Màn 1-3) hoặc tên cổng Endless + số màn khi ở chế độ endless; không kèm tiêu đề màn
    const titleString = this.mode === 'endless'
      ? localizedTitle
      : `${t('level_prefix')} ${this.level.id}`;

    const titleText = this.add
      .text(0, -toastH / 2 + 56, titleString, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: '24px',
        color: '#FFFFFF',
        stroke: '#16215A',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    toastContainer.add([shadow, card, chapterText, titleText]);

    // Hoạt cảnh pop-in, giữ 1.25s rồi trôi lên và biến mất
    toastContainer.setScale(0.65);
    toastContainer.setAlpha(0);

    this.tweens.add({
      targets: toastContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1250, () => {
          this.tweens.add({
            targets: toastContainer,
            y: cy - 28,
            alpha: 0,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 320,
            ease: 'Quad.easeIn',
            onComplete: () => toastContainer.destroy(),
          });
        });
      },
    });
  }

  /**
   * Tạo sóng lượng tử và chùm bụi sao khi chạm vào khoảng trống bầu trời
   */
  private spawnCosmicInteraction(x: number, y: number): void {
    const ripple = this.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 4);
    const rippleData = { radius: 8, alpha: 0.85 };
    this.tweens.add({
      targets: rippleData,
      radius: 65,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ripple.clear();
        ripple.lineStyle(2.5, 0x7fd8ff, rippleData.alpha);
        ripple.strokeCircle(x, y, rippleData.radius);
      },
      onComplete: () => ripple.destroy(),
    });

    const colors = [0xffd23f, 0x7fd8ff, 0xffffff];
    for (let i = 0; i < 6; i++) {
      const p = this.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 5);
      const col = colors[i % colors.length];
      p.fillStyle(col, 0.9);
      p.fillCircle(0, 0, 4);
      p.setPosition(x, y);

      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;

      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 450 + Math.random() * 200,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }
}
