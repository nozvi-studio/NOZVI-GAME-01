import Phaser from 'phaser';
import type { PlayViewSnapshot } from '../../application/playController.ts';
import {
  COLOR_NUMBERS,
  COLOR_TOKENS,
  DEPTH_TOKENS,
  FEEDBACK_TOKENS,
  LAYOUT_TOKENS,
  TYPO_TOKENS,
  VICTORY_CARD,
} from '../designTokens.ts';
import { TEXTURE_KEYS } from '../TextureFactory.ts';
import { computeLayout } from '../board/layout.ts';
import type { LayoutMetrics } from '../board/layout.ts';
import { drawJewel } from '../board/JewelShape.ts';
import { CHAPTERS, chapterInfo, chapterOfLevelId } from '../../content/chapters.ts';
import { t } from '../i18n.ts';
import {
  VICTORY_VERSE_FONT_SIZE,
  formatMatchCount,
  getSnapHintText,
  snapHintPillSize,
  getVictoryLabels,
} from './hudText.ts';
import { enter, exit, type Poseable } from '../transitions/choreography.ts';
import { stepScalar } from '../board/pieceMotion.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import type { TransitionTimeline } from '../transitions/TransitionTimeline.ts';
import {
  VICTORY_COLLAPSE_MS,
  VICTORY_COLLAPSE_SCALE,
  VICTORY_FINALE,
  victoryCardTop,
  type VictoryPlan,
} from '../feedback/victorySequence.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { cjkWordWrapCallback } from '../cjkWrap.ts';
import { starTexture } from '../sky/starTexture.ts';
import type { ResultCardModel } from './resultCardModel.ts';
import { computeMatchBarLayout } from './matchBarLayout.ts';

/** A Time or Best pill on the result card (mockup: 40 px high, 14 px padding, 8 px gaps). */
type ResultPill = { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Graphics | null; label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text };

const PILL = { height: 74, pad: 26, gap: 15, icon: 30, between: 18 } as const;

/** Circular arrow (mockup Replay / Reset glyph) centred on (x, y), `size` wide. */
function drawReplayIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number): void {
  const k = size / 24;
  g.lineStyle(2.6 * k, color, 1);
  g.beginPath();
  // Mockup path: arc of radius 7.5 around (12, 12) from -28° the long way round to 7.6°, then the arrow head.
  g.arc(x, y, 7.5 * k, Phaser.Math.DegToRad(-28), Phaser.Math.DegToRad(7.6), true);
  g.strokePath();
  g.beginPath();
  g.moveTo(x + 7.5 * k, y - 8 * k);
  g.lineTo(x + 7.5 * k, y - 3 * k);
  g.lineTo(x + 2.5 * k, y - 3 * k);
  g.strokePath();
}

/** Clock face (mockup Time pill icon) centred on (x, y), `size` wide. */
function drawClockIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const k = size / 12;
  g.lineStyle(1.4 * k, 0xffffff, 1);
  g.strokeCircle(x, y, 4.6 * k);
  g.beginPath();
  g.moveTo(x, y - 2.5 * k);
  g.lineTo(x, y + 0.2 * k);
  g.lineTo(x + 1.6 * k, y + 1.3 * k);
  g.strokePath();
}

export type HudCallbacks = {
  onMenu: () => void;
  onReset: () => void;
  onRotate: () => void;
  onToggleTarget: () => void;
  onNextLevel: () => void;
  onLevelSelect: () => void;
  /** The win card starts drawing in; anything circling it should collapse over `ms` too. */
  onWinCollapse?: (ms: number) => void;
};

export class Hud {
  private scene: Phaser.Scene;
  private callbacks: HudCallbacks;
  private levelId: string;

  private menuButton: Phaser.GameObjects.Container;
  private subtitleText: Phaser.GameObjects.Text;
  private targetButton: Phaser.GameObjects.Container;
  private targetIcon: Phaser.GameObjects.Image;

  private resetContainer: Phaser.GameObjects.Container;
  private rotateContainer: Phaser.GameObjects.Container;
  private rotateBtnBase: Phaser.GameObjects.Image;
  private rotateIcon: Phaser.GameObjects.Image;
  private rotateLabel: Phaser.GameObjects.Text;

  private winContainer: Phaser.GameObjects.Container;
  /** Dims everything behind the win card; separate from the card so it does not scale with it. */
  private winDim!: Phaser.GameObjects.Rectangle;
  /** Centre of the win card in design units: the card scales about this point. */
  private winCentre = { x: 360, y: 0 };
  private winCollapsing = false;
  private matchBar: Phaser.GameObjects.Container;
  private matchBarGraphics: Phaser.GameObjects.Graphics;
  private matchBarText: Phaser.GameObjects.Text;
  private snapHint: Phaser.GameObjects.Container | null = null;
  private winVerseText!: Phaser.GameObjects.Text;
  private winStars: Array<{ container: Phaser.GameObjects.Container; lit: Phaser.GameObjects.Image }> = [];
  private winTimePill!: ResultPill;
  private winBestPill!: ResultPill;
  private winPillY = 0;
  private winCardCx = 360;
  private resultModel: ResultCardModel | null = null;
  private winItems: Poseable[][] = [];
  private rotateAllowed = false;
  private matchIconCenters: number[] = [];
  private matchIconSize = 14;
  private hint = { alpha: 0, x: 0, y: 0 };
  private lastCanRotate: boolean | null = null;
  private readonly layout: LayoutMetrics;

  constructor(
    scene: Phaser.Scene,
    title: string,
    callbacks: HudCallbacks,
    levelId: string = '1-1',
    layout: LayoutMetrics = computeLayout(LAYOUT_TOKENS.canvas.width, LAYOUT_TOKENS.canvas.height)
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.levelId = levelId;
    this.layout = layout;

    // Màn dev (mã không theo "<chương>-<số>") hiển thị như Chương I
    const chapter = chapterInfo(chapterOfLevelId(this.levelId) ?? 1) ?? CHAPTERS[0];
    const chapterRoman = `${t('chapter_prefix')} ${chapter.roman}`;

    // Header bám mép trên đã trừ lề an toàn. Toạ độ y bên dưới là khoảng cách
    // tính từ đỉnh header trên artboard gốc, nên chỉ việc cộng thêm.
    const headerTop = this.layout.headerBounds.y;

    // 1. Nút Menu tròn 80px (Vùng chạm 96px, Góc trên trái: x=56, y=56)
    this.menuButton = this.scene.add.container(56, headerTop + 56);
    const menuBtn = this.scene.add
      .image(0, 0, TEXTURE_KEYS.btnCircle80)
      .setSize(96, 96)
      .setInteractive({ useHandCursor: true });
    const menuIcon = this.scene.add.image(0, 0, TEXTURE_KEYS.iconMenuBack).setScale(1.25);
    menuBtn.on('pointerdown', () => {
      this.animateButtonTap(menuBtn, () => this.callbacks.onMenu());
    });
    this.menuButton.add([menuBtn, menuIcon]);

    // 2. Dòng phụ Chương 24px, căn giữa header cùng hàng với hai nút tròn (x=360).
    // Màn chơi không còn tiêu đề riêng.
    const subtitleContent = this.levelId.startsWith('endless')
      ? `${chapterRoman} · ${t('gate_endless')}`
      : `${chapterRoman} · ${t('level_prefix')} ${this.levelId}`;

    this.subtitleText = this.scene.add
      .text(360, headerTop + 56, subtitleContent, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '24px',
        color: COLOR_TOKENS.text.secondary,
      })
      .setOrigin(0.5);

    // 3. Nút tròn Icon mắt bóng mục tiêu 80px (Vùng chạm 96px, Góc trên phải: x=664, y=56)
    this.targetButton = this.scene.add.container(664, headerTop + 56);
    const targetBtnBase = this.scene.add
      .image(0, 0, TEXTURE_KEYS.btnCircle80)
      .setSize(96, 96)
      .setInteractive({ useHandCursor: true });
    this.targetIcon = this.scene.add.image(0, 0, TEXTURE_KEYS.iconEyeOpen);

    targetBtnBase.on('pointerdown', () => {
      playUiCue(this.scene, 'tap');
      this.animateButtonTap(targetBtnBase, () => this.callbacks.onToggleTarget());
    });
    this.targetButton.add([targetBtnBase, this.targetIcon]);
    // Eye (target preview) retired: the dashed outline always shows the goal. Kept in code, hidden and inert.
    targetBtnBase.disableInteractive();
    this.targetButton.setVisible(false);

    // 4. Hàng nút dưới cùng: Đặt lại ở góc trái, Xoay ở góc phải (chỉ Chương
    // 4 — chương xoay), thanh đếm mảnh ở giữa — theo mockup. Trước đây nút Đặt lại nằm
    // giữa màn, ngay chỗ khay và thanh đếm, nên bị cả hai che.
    const rotationChapter = chapter.rotationEnabled;
    const bottomRowY = this.layout.bottomBarBounds.y + 44;
    const buttonScale = 0.8; // 112px -> ~90px, vẫn trên chuẩn chạm tối thiểu

    // A. Nút Đặt lại
    this.resetContainer = this.scene.add
      .container(84, bottomRowY)
      .setDepth(DEPTH_TOKENS.hudControls);
    const resetBtnBase = this.scene.add
      .image(0, 0, TEXTURE_KEYS.btnCircle112)
      .setScale(buttonScale)
      .setSize(112, 112)
      .setInteractive({ useHandCursor: true });
    const resetIcon = this.scene.add.image(0, 0, TEXTURE_KEYS.iconReset).setScale(0.6);
    const resetLabel = this.scene.add
      .text(0, 58, t('btn_reset'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '22px',
        color: COLOR_TOKENS.text.secondary,
      })
      .setOrigin(0.5);

    resetBtnBase.on('pointerdown', () => {
      this.animateButtonTap(resetBtnBase, () => this.callbacks.onReset());
    });
    this.resetContainer.add([resetBtnBase, resetIcon, resetLabel]);

    // B. Nút Xoay tròn 112px (chỉ hiện ở Chương 3)
    this.rotateContainer = this.scene.add
      .container(636, bottomRowY)
      .setDepth(DEPTH_TOKENS.hudControls);
    this.rotateBtnBase = this.scene.add
      .image(0, 0, TEXTURE_KEYS.btnCircle112)
      .setScale(buttonScale)
      .setSize(112, 112)
      .setInteractive({ useHandCursor: true });
    this.rotateIcon = this.scene.add.image(0, 0, TEXTURE_KEYS.iconRotate).setScale(0.6);
    this.rotateLabel = this.scene.add
      .text(0, 58, t('btn_rotate'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '22px',
        color: COLOR_TOKENS.text.secondary,
      })
      .setOrigin(0.5);

    this.rotateBtnBase.on('pointerdown', () => {
      this.animateButtonTap(this.rotateBtnBase, () => this.callbacks.onRotate());
    });
    this.rotateContainer.add([this.rotateBtnBase, this.rotateIcon, this.rotateLabel]);

    this.rotateAllowed = rotationChapter;
    if (!rotationChapter) {
      this.rotateContainer.setVisible(false);
    }

    // 5. Thanh đếm mảnh ở đáy: viên thuốc bo tròn, icon thoi đặc cho mảnh đã
    // khớp và thoi nét đứt cho mảnh còn lại.
    // Cùng hàng với nút Đặt lại để đáy màn hình đọc thành một dải
    const barY = this.layout.bottomBarBounds.y + 44;
    this.matchBar = this.scene.add.container(360, barY).setDepth(DEPTH_TOKENS.hudControls);
    this.matchBarGraphics = this.scene.add.graphics();
    this.matchBarText = this.scene.add
      .text(24, 0, formatMatchCount(0, 2), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: TYPO_TOKENS.fontSize.caption,
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0, 0.5);
    this.matchBar.add([this.matchBarGraphics, this.matchBarText]);

    // 6. Modal Hoàn Thành Chiến Thắng (Celestial Victory Dialog)
    this.winDim = this.scene.add
      .rectangle(0, 0, LAYOUT_TOKENS.canvas.width, this.layout.designHeight, 0x050818, 1)
      .setOrigin(0, 0)
      .setDepth(99)
      .setAlpha(0);
    this.winContainer = this.scene.add.container(0, 0).setDepth(100).setVisible(false);

    // Thẻ hoàn thành nổi chính giữa màn, trên lớp nền mờ; các mảnh đã thu lại
    // nên bàn chơi trống phía sau.
    const victoryLabels = getVictoryLabels();
    const card = {
      x: VICTORY_CARD.x,
      y: victoryCardTop(this.layout.designHeight),
      w: VICTORY_CARD.w,
      h: VICTORY_CARD.h,
    };
    const cx = card.x + card.w / 2;
    this.winCentre = { x: cx, y: card.y + card.h / 2 };
    const o = VICTORY_CARD.offsets;

    // Lớp chặn chạm xuống bàn, gần như trong suốt để không làm tối khung vàng
    const winOverlay = this.scene.add
      .rectangle(0, 0, LAYOUT_TOKENS.canvas.width, this.layout.designHeight, 0x000000, 0.01)
      .setOrigin(0, 0)
      .setInteractive();

    const cardFrame = this.scene.add
      .image(card.x, card.y, TEXTURE_KEYS.victoryCardFrame)
      .setOrigin(0, 0);
    const cardSurface = this.scene.add
      .image(card.x + 6, card.y + 6, TEXTURE_KEYS.victoryCardSurface)
      .setOrigin(0, 0);

    // Mockup VictoryStars: one gold heading, then stars, Time / Best, the two buttons and Replay.
    const winTitle = this.scene.add
      .text(cx, card.y + o.title, victoryLabels.eyebrow, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '37px',
        fontStyle: 'bold',
        color: '#FFD983',
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);

    // Only shown when there is no result (endless, harness): the chapter fact takes the stars' place.
    const winVerse = this.scene.add
      .text(cx, card.y + o.verse, '', {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${VICTORY_VERSE_FONT_SIZE}px`,
        color: '#FFFFFF',
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: card.w - 80, callback: cjkWordWrapCallback(card.w - 80) },
      })
      .setOrigin(0.5);
    this.winVerseText = winVerse;

    // Stars row: the centre star is larger and sits higher (mockup 58 / 76 / 58 px).
    this.winStars = VICTORY_CARD.stars.map(({ dx, dy, outer }) => {
      const star = this.scene.add.container(cx + dx, card.y + o.stars + dy);
      const lit = this.scene.add.image(0, 0, starTexture(this.scene, 'lit', outer));
      star.add([this.scene.add.image(0, 0, starTexture(this.scene, 'slot', outer)), lit]);
      return { container: star, lit };
    });

    const pillY = card.y + o.pills;
    const valueStyle = { fontFamily: TYPO_TOKENS.fontFamily.display, fontSize: '33px', fontStyle: 'bold', color: '#FFFFFF' };
    const labelStyle = { fontFamily: TYPO_TOKENS.fontFamily.sans, fontSize: '22px', color: '#C9D2FF' };
    this.winTimePill = {
      bg: this.scene.add.graphics(),
      icon: this.scene.add.graphics(),
      label: this.scene.add.text(0, pillY, t('victory_time'), labelStyle).setOrigin(0, 0.5),
      value: this.scene.add.text(0, pillY, '0:00', valueStyle).setOrigin(0, 0.5),
    };
    this.winBestPill = {
      bg: this.scene.add.graphics(),
      icon: null,
      label: this.scene.add.text(0, pillY, t('victory_best'), labelStyle).setOrigin(0, 0.5),
      value: this.scene.add.text(0, pillY, '0:00', { ...valueStyle, color: '#FFE29A' }).setOrigin(0, 0.5),
    };
    this.winPillY = pillY;
    this.winCardCx = cx;

    // Hai nút nằm ngang: Chọn màn (viền băng) | Màn tiếp theo (vàng, rộng hơn 1.4 lần)
    const btn = VICTORY_CARD.buttons;
    const btnTop = card.y + o.buttonTop;
    const btnH = VICTORY_CARD.buttonHeight;
    const innerLeft = cx - (btn.selectW + btn.gap + btn.nextW) / 2;
    const nextX = innerLeft + btn.selectW + btn.gap;

    const selectBtnBg = this.scene.add.graphics();
    selectBtnBg.fillStyle(0x0a0a28, 0.5);
    selectBtnBg.fillRoundedRect(innerLeft, btnTop, btn.selectW, btnH, btnH / 2);
    selectBtnBg.lineStyle(4, COLOR_NUMBERS.icePrimary, 1);
    selectBtnBg.strokeRoundedRect(innerLeft, btnTop, btn.selectW, btnH, btnH / 2);

    const selectBtn = this.scene.add
      .text(innerLeft + btn.selectW / 2, btnTop + btnH / 2, victoryLabels.levelSelect, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '28px',
        fontStyle: 'bold',
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0.5);
    const selectHit = this.scene.add
      .zone(innerLeft, btnTop, btn.selectW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    selectHit.on('pointerup', () => {
      playUiCue(this.scene, 'tap');
      this.callbacks.onLevelSelect();
    });

    // Gold button with the mockup's hard bottom shadow (0 4px 0 #B87514).
    const nextBtnBg = this.scene.add.container(0, 0, [
      this.scene.add.graphics().fillStyle(0xb87514, 1).fillRoundedRect(nextX, btnTop + 7, btn.nextW, btnH, btnH / 2),
      this.scene.add.image(nextX, btnTop, TEXTURE_KEYS.victoryNextButton).setOrigin(0, 0).setDisplaySize(btn.nextW, btnH),
    ]);
    const nextBtn = this.scene.add
      .text(nextX + btn.nextW / 2, btnTop + btnH / 2, victoryLabels.next, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#1A1446',
      })
      .setOrigin(0.5);
    const nextHit = this.scene.add
      .zone(nextX, btnTop, btn.nextW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    nextHit.on('pointerup', () => {
      if (this.winCollapsing) return;
      playUiCue(this.scene, 'tap');
      // The card draws in like the glass pieces did, then the next level takes over.
      this.collapseWinCard(() => this.callbacks.onNextLevel());
    });

    // Replay: a quiet text link under the buttons; it resets the level like the Reset button.
    const replayY = card.y + o.replay;
    const replayText = this.scene.add
      .text(0, replayY, t('victory_replay'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#D6E4FF',
      })
      .setOrigin(0, 0.5);
    const replayIconSize = 26;
    const replayW = replayIconSize + 11 + replayText.width;
    const replayLeft = cx - replayW / 2;
    replayText.setX(replayLeft + replayIconSize + 11);
    const replayIcon = this.scene.add.graphics();
    drawReplayIcon(replayIcon, replayLeft + replayIconSize / 2, replayY, replayIconSize, 0xd6e4ff);
    const replayHit = this.scene.add
      .zone(cx, replayY, Math.max(LAYOUT_TOKENS.buttonSizes.minTouchArea, replayW + 40), 64)
      .setInteractive({ useHandCursor: true });
    replayHit.on('pointerup', () => {
      if (this.winCollapsing) return;
      playUiCue(this.scene, 'tap');
      this.callbacks.onReset();
    });

    // One wrapper at (0, 0) for the stars and pills: the reveal timeline poses only the wrapper,
    // so applyResult can lay out the pill texts and pop the stars without the timeline undoing it.
    const winResult = this.scene.add.container(0, 0, [
      ...this.winStars.map((s) => s.container),
      this.winTimePill.bg,
      this.winTimePill.icon!,
      this.winTimePill.label,
      this.winTimePill.value,
      this.winBestPill.bg,
      this.winBestPill.label,
      this.winBestPill.value,
    ]);

    const group1 = [cardFrame, cardSurface, winTitle];
    const group2 = [this.winVerseText, winResult];
    const group3 = [selectBtnBg, selectBtn, nextBtnBg, nextBtn, replayIcon, replayText];

    this.winItems = [group1, group2, group3];

    this.winContainer.add([
      winOverlay,
      cardFrame,
      cardSurface,
      winTitle,
      winResult,
      this.winVerseText,
      selectBtnBg,
      selectBtn,
      selectHit,
      nextBtnBg,
      nextBtn,
      nextHit,
      replayIcon,
      replayText,
      replayHit,
    ]);
  }

  private animateButtonTap(target: Phaser.GameObjects.GameObject, onComplete: () => void): void {
    this.scene.tweens.add({
      targets: target,
      scaleX: 0.94,
      scaleY: 0.94,
      duration: 80,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete,
    });
  }

  public update(snapshot: PlayViewSnapshot): void {
    this.targetIcon.setTexture(snapshot.showTarget ? TEXTURE_KEYS.iconEyeOpen : TEXTURE_KEYS.iconEyeClosed);

    if (snapshot.canRotate !== this.lastCanRotate) {
      this.lastCanRotate = snapshot.canRotate;
      if (snapshot.canRotate) this.rotateBtnBase.setInteractive({ useHandCursor: true });
      else this.rotateBtnBase.disableInteractive();
      this.scene.tweens.killTweensOf(this.rotateContainer);
      this.scene.tweens.add({
        targets: this.rotateContainer,
        alpha: snapshot.canRotate ? 1.0 : 0.3,
        duration: FEEDBACK_TOKENS.rotateButtonFadeMs,
        ease: 'Sine.easeInOut',
      });
    }

    this.drawMatchBar(snapshot.snappedCount, snapshot.totalPieces);

    if (snapshot.phase !== 'won' && this.winContainer.visible) {
      this.hideWinModal();
    }
  }

  /**
   * Vẽ lại thanh đếm. Chiều rộng viên thuốc co theo độ dài chữ nên số mảnh
   * đổi thì khung vẫn ôm sát.
   */
  private drawMatchBar(matched: number, total: number): void {
    this.matchBarText.setText(formatMatchCount(matched, total));
    const actionRadius = 112 * 0.8 / 2;
    const bar = computeMatchBarLayout(
      total,
      this.matchBarText.width,
      this.resetContainer.x + actionRadius + 16,
      this.rotateAllowed ? this.rotateContainer.x - actionRadius - 16 : LAYOUT_TOKENS.canvas.width - 24
    );
    const { width, iconSize } = bar;
    this.matchIconCenters = bar.iconCenters;
    this.matchIconSize = iconSize;
    const height = 56;

    this.matchBar.setX(bar.centerX);
    this.matchBarText.setX(bar.textX).setScale(bar.textScale);

    const g = this.matchBarGraphics;
    g.clear();
    g.fillStyle(COLOR_NUMBERS.boardSurfaceBottom, 0.6);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    g.lineStyle(1.5, COLOR_NUMBERS.icePrimary, 0.6);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);

    for (const [i, cx] of bar.iconCenters.entries()) {
      drawJewel(g, {
        cx,
        cy: 0,
        radius: iconSize,
        variant: i < matched ? 'solid' : 'placeholder',
      });
    }
  }

  /** Nhãn "Thả để khớp": hiện/ẩn trong ~120 ms, bám mảnh với τ 60 ms */
  public tickSnapHint(dtMs: number, target: { x: number; y: number } | null): void {
    if (!this.snapHint) {
      const label = this.scene.add
        .text(0, 0, getSnapHintText(), {
          fontFamily: TYPO_TOKENS.fontFamily.sans,
          fontSize: '22px',
          color: COLOR_TOKENS.text.onAmber,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      const pill = snapHintPillSize(label.width);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0xfff4d2, 1);
      bg.fillRoundedRect(-pill.width / 2, -pill.height / 2, pill.width, pill.height, 14);
      this.snapHint = this.scene.add.container(0, 0, [bg, label]).setDepth(DEPTH_TOKENS.hudControls).setAlpha(0);
    }
    const reduced = isReducedMotion();
    const goal = target ? 1 : 0;
    const fadeTau = FEEDBACK_TOKENS.hintMs / 3;
    if (target && this.hint.alpha < 0.01) {
      this.hint.x = target.x;
      this.hint.y = target.y;
    } else if (target) {
      this.hint.x = reduced ? target.x : stepScalar(this.hint.x, target.x, dtMs, FEEDBACK_TOKENS.tau.hint);
      this.hint.y = reduced ? target.y : stepScalar(this.hint.y, target.y, dtMs, FEEDBACK_TOKENS.tau.hint);
    }
    this.hint.alpha = stepScalar(this.hint.alpha, goal, dtMs, fadeTau);
    if (Math.abs(this.hint.alpha - goal) < 0.01) this.hint.alpha = goal;
    const scale = reduced ? 1 : 0.9 + 0.1 * this.hint.alpha;
    this.snapHint
      .setPosition(this.hint.x, this.hint.y)
      .setAlpha(this.hint.alpha)
      .setScale(scale)
      .setVisible(this.hint.alpha > 0);
  }

  /** Campaign levels show the time bar under the label, so the label moves up. */
  public setSubtitleY(y: number): void {
    this.subtitleText.setY(y);
  }

  /** Biểu tượng thứ `index` trên thanh đếm bật 1.3 → 1 khi một mảnh khớp */
  public popCounterIcon(index: number): void {
    const cx = this.matchIconCenters[index];
    if (cx === undefined || isReducedMotion()) return;
    const pop = this.scene.add.graphics();
    drawJewel(pop, { cx: 0, cy: 0, radius: this.matchIconSize, variant: 'solid' });
    pop.setPosition(cx, 0).setScale(FEEDBACK_TOKENS.counterPopScale);
    this.matchBar.add(pop);
    this.scene.tweens.add({
      targets: pop,
      scaleX: 1,
      scaleY: 1,
      duration: FEEDBACK_TOKENS.counterPopMs,
      ease: 'Back.easeOut',
      onComplete: () => pop.destroy(),
    });
  }

  /** Result of the run that just ended (or the saved one when the level opens already won). */
  public setResult(model: ResultCardModel | null): void {
    this.resultModel = model;
  }

  /** Width of a pill once its texts are set. */
  private pillWidth(pill: ResultPill): number {
    const icon = pill.icon ? PILL.icon + PILL.gap : 0;
    return PILL.pad * 2 + icon + pill.label.width + PILL.gap + pill.value.width;
  }

  private layoutPill(pill: ResultPill, xLeft: number, border: number, borderAlpha: number): void {
    const width = this.pillWidth(pill);
    const top = this.winPillY - PILL.height / 2;
    let x = xLeft + PILL.pad;
    if (pill.icon) {
      pill.icon.clear();
      drawClockIcon(pill.icon, x + PILL.icon / 2, this.winPillY, PILL.icon);
      x += PILL.icon + PILL.gap;
    }
    pill.label.setX(x);
    pill.value.setX(x + pill.label.width + PILL.gap);
    pill.bg.clear();
    pill.bg.fillStyle(0x05051e, 0.55).fillRoundedRect(xLeft, top, width, PILL.height, PILL.height / 2);
    pill.bg.lineStyle(3, border, borderAlpha).strokeRoundedRect(xLeft, top, width, PILL.height, PILL.height / 2);
  }

  /** Fill stars and pills from the model; stars pop in one after another unless motion is reduced. */
  private applyResult(): void {
    const model = this.resultModel;
    const reduced = isReducedMotion();
    this.winStars.forEach((star, i) => {
      this.scene.tweens.killTweensOf(star.container);
      const earned = model !== null && i < model.stars;
      star.lit.setVisible(earned);
      star.container.setVisible(model !== null).setScale(1).setAngle(0);
      if (model !== null && !reduced) {
        star.container.setScale(0).setAngle(-40);
        this.scene.tweens.add({
          targets: star.container,
          scale: 1,
          angle: 0,
          duration: 500,
          delay: 500 + i * 300,
          ease: 'Back.easeOut',
        });
      }
    });

    const showBest = model?.best != null;
    const parts = (p: ResultPill) => [p.bg, p.label, p.value, ...(p.icon ? [p.icon] : [])];
    for (const p of [this.winTimePill, this.winBestPill]) for (const o of parts(p)) o.setVisible(false);
    if (model === null) return;

    this.winTimePill.value.setText(model.timeText);
    if (model.best) this.winBestPill.value.setText(model.best.text);
    // Measure first, then centre the pair around the card centre.
    const timeW = this.pillWidth(this.winTimePill);
    const total = timeW + (model.best ? PILL.between + this.pillWidth(this.winBestPill) : 0);
    const x0 = this.winCardCx - total / 2;
    this.layoutPill(this.winTimePill, x0, COLOR_NUMBERS.icePrimary, 1);
    for (const o of parts(this.winTimePill)) o.setVisible(true);
    if (showBest && model.best) {
      const gold = model.best.highlight;
      this.layoutPill(this.winBestPill, x0 + timeW + PILL.between, gold ? 0xffc857 : 0xffffff, gold ? 1 : 0.25);
      for (const o of parts(this.winBestPill)) o.setVisible(true);
    }
  }

  /** Nội dung và chỗ đứng của thẻ; không đụng tư thế để dàn dựng tự lo */
  private prepareWinModal(victoryVerse?: string): void {
    this.applyResult();
    // A result (campaign) replaces the fact; without one (endless, harness) the fact fills the gap.
    const verse = this.resultModel === null ? victoryVerse ?? '' : '';
    this.winVerseText.setFontSize(VICTORY_VERSE_FONT_SIZE);
    this.winVerseText.setText(verse).setVisible(verse !== '');
    if (this.winVerseText.height > 106) {
      this.winVerseText.setFontSize(21);
    }
    // Thẻ chiếm chỗ hàng đáy, nên nút và thanh đếm phải nhường chỗ
    this.resetContainer.setVisible(false);
    this.rotateContainer.setVisible(false);
    this.matchBar.setVisible(false);
    this.winContainer.setVisible(true);
  }

  /** Hiện ngay (khôi phục trạng thái đã thắng) */
  public showWinModal(victoryVerse?: string): void {
    this.poseWinCard(1);
    this.winContainer.setAlpha(1);
    this.winDim.setAlpha(VICTORY_FINALE.dimAlpha);
    this.prepareWinModal(victoryVerse);
  }

  /** Scale the card about its own centre (a container scales about its origin, so shift it to compensate). */
  private poseWinCard(scale: number, rise = 0): void {
    this.winContainer
      .setScale(scale)
      .setPosition(this.winCentre.x * (1 - scale), this.winCentre.y * (1 - scale) + rise);
  }

  /**
   * Chuỗi thắng: thẻ trượt lên, bốn nhóm con hiện so le. Mọi `enter` lên lịch
   * ngay (đặt tư thế lệch lúc thẻ còn ẩn); lời gọi hiện thẻ ở cùng mốc đứng
   * sau các tween, nên `complete()` gói gọn trong một lượt xử lý.
   */
  public playWinCard(tl: TransitionTimeline, plan: VictoryPlan, victoryVerse?: string): void {
    // The card pops in from a smaller size with a short rise; the final pose is the resting one.
    const rise = Math.min(plan.cardSlidePx, VICTORY_FINALE.cardRisePx);
    const pop = { p: plan.cardMs > 0 && plan.cardScaleFrom < 1 ? 0 : 1 };
    const apply = () => this.poseWinCard(plan.cardScaleFrom + (1 - plan.cardScaleFrom) * pop.p, rise * (1 - pop.p));
    apply();
    this.winContainer.setAlpha(0);
    tl.at(plan.cardAtMs, this.winContainer, { alpha: 1 }, plan.cardMs, 'cubicOut');
    tl.at(plan.cardAtMs, pop, { p: 1 }, plan.cardMs, 'cubicOut', apply);
    this.winItems.forEach((group, i) => {
      for (const item of group) {
        enter(tl, item, plan.cardAtMs + i * plan.cardItemGapMs, plan.cardItemMs, { alpha: 0 });
      }
    });
    tl.call(plan.cardAtMs, () => this.prepareWinModal(victoryVerse));
  }

  /** Dim the world behind the card; call from the victory timeline. */
  public playWinDim(tl: TransitionTimeline, plan: VictoryPlan): void {
    const dim = { a: this.winDim.alpha };
    tl.at(plan.dimAtMs, dim, { a: plan.dimAlpha }, plan.dimMs, 'sineInOut', () => this.winDim.setAlpha(dim.a));
  }

  public unwindWinCard(tl: TransitionTimeline, ms: number): void {
    exit(tl, this.winContainer, 0, ms, { dy: 60, alpha: 0 });
    const dim = { a: this.winDim.alpha };
    tl.at(0, dim, { a: 0 }, ms, 'sineInOut', () => this.winDim.setAlpha(dim.a));
    tl.call(ms, () => this.hideWinModal());
  }

  /** The card draws in to its centre, with stardust following, then hands over to `onDone`. */
  private collapseWinCard(onDone: () => void): void {
    if (this.winCollapsing) return;
    this.winCollapsing = true;
    if (isReducedMotion()) {
      onDone();
      return;
    }
    this.callbacks.onWinCollapse?.(VICTORY_COLLAPSE_MS);
    const dimFrom = this.winDim.alpha;
    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: VICTORY_COLLAPSE_MS,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        this.poseWinCard(1 - (1 - VICTORY_COLLAPSE_SCALE) * state.t);
        this.winContainer.setAlpha(1 - state.t);
        this.winDim.setAlpha(dimFrom * (1 - state.t));
      },
      onComplete: onDone,
    });
  }

  /** Centre and half-extents of the circuit the finale's stardust flies around the card. */
  public winCardOrbit(): { x: number; y: number; rx: number; ry: number } {
    return {
      x: this.winCentre.x,
      y: this.winCentre.y,
      rx: (VICTORY_CARD.w / 2) * 1.15,
      ry: (VICTORY_CARD.h / 2) * 1.4,
    };
  }

  public hideWinModal(): void {
    this.winCollapsing = false;
    this.winDim.setAlpha(0);
    this.winContainer.setVisible(false).setScale(1).setPosition(0, 0).setAlpha(1);
    this.resetContainer.setVisible(true);
    this.rotateContainer.setVisible(this.rotateAllowed);
    this.matchBar.setVisible(true);
  }

  /** Design-space bounds of the Rotate button (for the tutorial spotlight); null when it is not shown. */
  public rotateButtonBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.rotateContainer.visible) return null;
    const bounds = this.rotateBtnBase.getBounds();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  }

  public getTransitionParts(): { title: Poseable[]; topButtons: Poseable[]; bottomBar: Poseable[]; winCard: Poseable[] } {
    return {
      title: [this.subtitleText],
      topButtons: [this.menuButton, this.targetButton],
      bottomBar: [this.resetContainer, this.matchBar, this.rotateContainer],
      winCard: [this.winContainer],
    };
  }

  public destroy(): void {
    this.menuButton.destroy();
    this.matchBar.destroy();
    this.snapHint?.destroy();
    this.subtitleText.destroy();
    this.targetButton.destroy();
    this.resetContainer.destroy();
    this.rotateContainer.destroy();
    this.winContainer.destroy();
    this.winDim.destroy();
  }
}
