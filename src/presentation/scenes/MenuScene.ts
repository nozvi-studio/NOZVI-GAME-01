import { getSafeStorage, memoryStorage } from '../../engine/core/platform/safeStorage.ts';
import Phaser from 'phaser';
import { campaignManifest } from '../../content/manifest.ts';
import { resolveNextCampaignLevel } from '../../domain/campaign.ts';
import { createProgressRepository } from '../../infrastructure/progressRepository.ts';
import type { ProgressRepository } from '../../application/progressPort.ts';
import { COLOR_NUMBERS, DEPTH_TOKENS, TYPO_TOKENS, glowTier } from '../designTokens.ts';
import { TextureFactory } from '../TextureFactory.ts';
import { applyDesignViewport, designSafeArea, designViewBounds } from '../../engine/core/viewport/designViewport.ts';
import { SettingsDialog } from '../dialogs/SettingsDialog.ts';
import { LanguageSelectDialog } from '../dialogs/LanguageSelectDialog.ts';
import { LOCALE_REGISTRY } from '../../localization/localizationConfig.ts';
import { t, getLocale } from '../i18n.ts';
import { formatMenuContinueSubtext } from '../hud/hudText.ts';
import { director } from '../transitions/SceneDirector.ts';
import type { Choreographed, TransitionContext } from '../transitions/SceneDirector.ts';
import type { TransitionTimeline } from '../transitions/TransitionTimeline.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { applySteps } from '../transitions/choreography.ts';
import type { Parts } from '../transitions/choreography.ts';
import { MENU_OUT_TO_MAP, MENU_OUT_TO_PLAY, MENU_SPECIAL, menuIn } from '../transitions/routes.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { CHAPTER_ONE_HERO_SCALE, DualJewelEmblem } from '../menu/DualJewelEmblem.ts';
import { MENU_K, createPrimaryButtonImage, drawGear, drawGlassPanel } from '../menu/menuButtons.ts';
import { strokeDiamond } from '../menu/diamondMotif.ts';
import { resolveCurrentGalaxyTheme, resolveGalaxyTheme } from '../galaxy/galaxyTheme.ts';
import { ChapterHeroEmblem } from '../menu/ChapterHeroEmblem.ts';
import { heroKindFor } from '../menu/chapterHeroGeometry.ts';
import type { GalaxyTheme } from '../galaxy/galaxyTheme.ts';
import { computeMenuLayout, type MenuLayout } from '../menu/menuLayout.ts';
import { addGalaxyArtwork, galaxyGradient, preloadGalaxyArtwork } from '../galaxy/GalaxyArtwork.ts';
import { setPcBackground } from '../sky/pcBackground.ts';
import { deviceTilt } from '../sky/deviceTilt.ts';
import { ensureParallaxStarTexture, ensureSoftDotTexture } from '../sky/parallaxStars.ts';

/** The surface MenuScene drives on whichever hero emblem the chapter uses. */
type MenuEmblem = Pick<DualJewelEmblem, 'graphics' | 'setRingSpeed' | 'update'>;

export class MenuScene extends Phaser.Scene implements Choreographed {
  readonly directorKey = 'MenuScene' as const;
  private progressRepo!: ProgressRepository;
  private emblem!: MenuEmblem;
  /** Dev-only theme override from ?chapter=N. */
  private previewChapter?: number;
  private uiContainer!: Phaser.GameObjects.Container;
  private titleBlock!: Phaser.GameObjects.Container;
  private primaryButton!: Phaser.GameObjects.Container;
  private secondaryButton!: Phaser.GameObjects.Container;
  private settingsButton!: Phaser.GameObjects.Container;
  private langPillContainer!: Phaser.GameObjects.Container;
  private mirrorLogoContainer?: Phaser.GameObjects.Container;
  private logoSheenGraphics?: Phaser.GameObjects.Graphics;
  private letterObjects: {
    highlight: Phaser.GameObjects.Text;
    main: Phaser.GameObjects.Text;
    extrusion: Phaser.GameObjects.Text;
    shadow: Phaser.GameObjects.Text;
    baseY: number;
  }[] = [];
  private lastTrailTime = 0;
  private galaxy!: Phaser.GameObjects.Container;
  private galaxySky!: Phaser.GameObjects.Image;

  private deepStarsContainer?: Phaser.GameObjects.Container;
  private midStarsContainer?: Phaser.GameObjects.Container;
  private blockOffsetY = 0;
  private layout!: MenuLayout;
  private safe = { top: 0, right: 0, bottom: 0, left: 0 };
  private ambientMotes: Array<{ graphics: Phaser.GameObjects.Image; angle: number; dist: number; speed: number; yOffset: number }> = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  init(data: { chapter?: number } = {}): void {
    this.previewChapter = data.chapter;
  }

  private currentTheme(completed: readonly string[]): GalaxyTheme {
    return this.previewChapter ? resolveGalaxyTheme(this.previewChapter) : resolveCurrentGalaxyTheme(completed);
  }

  preload(): void {
    // Only the current chapter's artwork is needed here; the map loads the rest.
    const { progress } = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2').read();
    preloadGalaxyArtwork(this, [this.currentTheme(progress.completed).id]);
  }

  create(): void {
    applyDesignViewport(this);
    TextureFactory.generateAll(this);

    this.progressRepo = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2');
    const { progress } = this.progressRepo.read();

    const view = designViewBounds(this);
    this.safe = designSafeArea(this);
    this.blockOffsetY = 0;
    this.layout = computeMenuLayout(view.height, this.safe.top, this.safe.bottom);

    const theme = this.currentTheme(progress.completed);
    setPcBackground(theme.chapter);
    this.galaxySky = this.add.image(0, 0, galaxyGradient(this, theme))
      .setOrigin(0).setDisplaySize(view.width, view.height).setDepth(-3);
    this.createMenuParallaxLayers(view.width, view.height, theme);
    this.galaxy = addGalaxyArtwork(this, theme, 360, this.layout.emblemY, 900, { rx: 314, ry: 425 }).setDepth(-1);

    // 2. Biểu tượng Ngọc Đôi (Dual Jewels XOR) lơ lửng ở trung tâm
    // Chapter I uses the static Menu1 hero, chapters IV-VI their Menu3/Menu4 heroes; the rest keep the animated XOR emblem.
    const heroChapterOne = theme.chapter === 1;
    const heroKind = heroKindFor(theme.id);
    const heroStatic = heroChapterOne || heroKind !== undefined;
    this.emblem = heroKind
      ? new ChapterHeroEmblem(this, 360, this.layout.emblemY, heroKind, theme.colors.accent)
      : new DualJewelEmblem(this, 360, this.layout.emblemY, heroChapterOne ? theme.colors.accent : undefined);
    const emblemBaseScale = heroStatic ? CHAPTER_ONE_HERO_SCALE : 1.35;
    this.emblem.graphics().forEach(graphic => graphic.setScale(emblemBaseScale * this.layout.emblemScale));
    this.setupAmbientMotes(theme);
    this.setupEmblemInteraction(theme);

    // 3. UI Container chính
    this.uiContainer = this.add.container(0, this.blockOffsetY);
    this.buildMainMenu(progress.completed);

    // 4. Thiết lập tương tác chạm bụi sao & sóng lượng tử trên bầu trời
    this.setupCosmicSkyInteractions();

    director.attach(this);
  }

  private buildMainMenu(completedLevels: readonly string[]): void {
    this.uiContainer.removeAll(true);

    // Xác định màn kế tiếp và Theme thiên hà tương ứng
    const nextResolution = resolveNextCampaignLevel(campaignManifest, completedLevels);
    const targetLevel = nextResolution.level;
    const currentTheme = this.currentTheme(completedLevels);

    const btnLabelText =
      nextResolution.type === 'start'
        ? t('btn_start')
        : nextResolution.type === 'continue'
        ? t('btn_continue')
        : t('btn_replay');

    const K = MENU_K;
    const accent = currentTheme.colors.accent;
    // Mockup: language pill at top 22 / left 16, settings at top 20 / right 16 (44 px circle)
    const topY = this.safe.top + 74 - this.blockOffsetY;

    // Nút chọn Ngôn ngữ (Language Pill) hiển thị mã ngôn ngữ hiện tại, mở modal LanguageSelectDialog
    const currentLoc = getLocale();
    const meta = (LOCALE_REGISTRY as Record<string, any>)[currentLoc] ?? LOCALE_REGISTRY['en-US'];
    const pillW = 76 * K;
    const pillH = 36 * K;
    const pillX = 16 * K + pillW / 2;

    const langPillBg = this.add.graphics();
    drawGlassPanel(langPillBg, -pillW / 2, -pillH / 2, pillW, pillH, 18 * K, accent, 1.5 * K);

    const globeIcon = this.add
      .text(-14 * K, 0, '🌐', {
        fontSize: `${Math.round(15 * K)}px`,
      })
      .setOrigin(0.5);

    const langCodeText = this.add
      .text(12 * K, 0, meta.shortLabel, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: `${Math.round(13 * K)}px`,
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const langHitZone = this.add
      .zone(0, 0, pillW, pillH)
      .setInteractive({ useHandCursor: true });
    langHitZone.on('pointerdown', () => {
      new LanguageSelectDialog(this, () => {
        this.buildMainMenu(completedLevels);
      }).open();
    });

    this.langPillContainer = this.add.container(pillX, topY, [langPillBg, globeIcon, langCodeText, langHitZone]);

    // Nút Cài đặt: vòng tròn 44 px, viền accent, bánh răng trắng 22 px
    const gearD = 44 * K;
    const settingsBg = this.add.graphics();
    settingsBg.fillStyle(0x0a0a28, 0.55);
    settingsBg.fillCircle(0, 0, gearD / 2);
    settingsBg.lineStyle(1.5 * K, accent, 1);
    settingsBg.strokeCircle(0, 0, gearD / 2 - 0.75 * K);
    const settingsIcon = this.add.graphics();
    drawGear(settingsIcon, 22 * K);
    const settingsBtn = this.add.zone(0, 0, 96, 96).setInteractive({ useHandCursor: true });
    this.settingsButton = this.add.container(720 - 16 * K - gearD / 2, topY + 3, [settingsBg, settingsIcon, settingsBtn]);
    settingsBtn.on('pointerdown', () => {
      this.animateButtonTap(this.settingsButton, () => this.openSettings());
    });

    // -------------------------------------------------------------
    // LOGO PHƯƠNG ÁN 2: GƯƠNG ĐÔI (CASUAL LOGO WITH MIRROR REFLECTION)
    // -------------------------------------------------------------
    this.titleBlock = this.add.container(0, 0);
    this.buildCasualMirrorLogo(currentTheme);
    this.mirrorLogoContainer!.setPosition(-72, this.layout.logoCenterY - 234).setScale(1.2);

    // The chapter badge is gone: the Start button already names the chapter under its label.

    // -------------------------------------------------------------
    // 1. NÚT CHÍNH: Tiếp tục (gradient hổ phách, cạnh dưới 5px, quầng sáng)
    // -------------------------------------------------------------
    const btnWidth = 460;
    const btnHeight = 60 * K;
    const btnX = 360;
    const btnY = this.layout.primaryY;

    const primaryBtnContainer = this.add.container(btnX, btnY);
    const btnFace = createPrimaryButtonImage(this, btnWidth, btnHeight);

    const mainBtnText = this.add
      .text(0, -16, btnLabelText, {
        fontFamily: TYPO_TOKENS.fontFamily.display,
        fontSize: `${Math.round(21 * K)}px`,
        color: '#1A1446',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const subText = formatMenuContinueSubtext(targetLevel.id);
    const subBtnText = this.add
      .text(0, 22, subText, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${Math.round(12 * K)}px`,
        color: '#1A1446',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const btnZone = this.add
      .zone(0, 0, btnWidth, btnHeight)
      .setInteractive({ useHandCursor: true });

    btnZone.on('pointerdown', () => {
      playUiCue(this, 'tap');
      primaryBtnContainer.y = btnY + 4;
      primaryBtnContainer.setScale(0.97);
    });

    btnZone.on('pointerup', () => {
      btnZone.disableInteractive();
      this.tweens.add({
        targets: primaryBtnContainer,
        y: btnY,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          director.go(this, 'PlayScene', { levelId: targetLevel.id }, {
            route: 'menu-to-play',
            origin: { x: btnX, y: btnY },
          });
        },
      });
    });

    btnZone.on('pointerout', () => {
      primaryBtnContainer.y = btnY;
      primaryBtnContainer.setScale(1);
    });

    primaryBtnContainer.add([btnFace, mainBtnText, subBtnText, btnZone]);
    this.primaryButton = primaryBtnContainer;

    // -------------------------------------------------------------
    // 2. NÚT PHỤ: Chọn màn chơi (kính tối, viền accent 2 px)
    // -------------------------------------------------------------
    const secBtnY = this.layout.secondaryY;
    const secHeight = 48 * K;
    const secBtnContainer = this.add.container(btnX, secBtnY);

    const secFace = this.add.graphics();
    drawGlassPanel(secFace, -btnWidth / 2, -secHeight / 2, btnWidth, secHeight, 16 * K, accent, 2 * K);

    const secBtnText = this.add
      .text(0, 0, t('btn_select_level'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: `${Math.round(15 * K)}px`,
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const secBtnZone = this.add
      .zone(0, 0, btnWidth, secHeight)
      .setInteractive({ useHandCursor: true });

    secBtnZone.on('pointerdown', () => {
      playUiCue(this, 'tap');
      secBtnContainer.y = secBtnY + 3;
      secBtnContainer.setScale(0.97);
    });

    secBtnZone.on('pointerup', () => {
      secBtnZone.disableInteractive();
      this.tweens.add({
        targets: secBtnContainer,
        y: secBtnY,
        scaleX: 1,
        scaleY: 1,
        duration: 90,
        ease: 'Back.easeOut',
        onComplete: () => {
          director.go(this, 'LevelSelectScene', {}, { route: 'menu-to-map' });
        },
      });
    });

    secBtnZone.on('pointerout', () => {
      secBtnContainer.y = secBtnY;
      secBtnContainer.setScale(1);
    });

    secBtnContainer.add([secFace, secBtnText, secBtnZone]);
    this.secondaryButton = secBtnContainer;

    // Version lives in the Settings dialog now; the bottom strip is reserved for a banner ad (layout.adSlotY).
    this.uiContainer.add([
      this.langPillContainer,
      this.settingsButton,
      this.titleBlock,
      this.primaryButton,
      this.secondaryButton,
    ]);
  }

  /**
   * Dựng cụm logo MIRROR phong cách Phương án 2 (Gương Đôi)
   * Có hiệu ứng xuất hiện thả rơi đàn hồi và loop hoạt cảnh trôi / quét sáng
   */
  private buildCasualMirrorLogo(theme?: GalaxyTheme): void {
    if (this.mirrorLogoContainer) {
      this.mirrorLogoContainer.destroy();
    }
    this.letterObjects = [];
    this.mirrorLogoContainer = this.add.container(0, 0);
    this.titleBlock.add(this.mirrorLogoContainer);

    const letters = [
      { char: 'M', dx: -180, rot: -4 },
      { char: 'I', dx: -110, rot: 3 },
      { char: 'R', dx: -45, rot: -3 },
      { char: 'R', dx: 38, rot: 4 },
      { char: 'O', dx: 114, rot: -3 },
      { char: 'R', dx: 182, rot: 4 },
    ];

    const logoY = 195;
    const barY = 248;
    const accentHex = theme ? theme.colors.accentHex : '#7FD8FF';
    const accentColor = theme ? theme.colors.accent : 0x7fd8ff;

    // 1. Bóng phản chiếu màu accent của chương bên dưới thanh gương (Mirror Reflection)
    for (let i = 0; i < letters.length; i++) {
      const item = letters[i];
      const x = 360 + item.dx;
      const refY = barY + 36;
      const refText = this.add
        .text(x, refY, item.char, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '76px',
          color: accentHex,
          stroke: '#0B163A',
          strokeThickness: 10,
        })
        .setOrigin(0.5)
        .setAngle(item.rot)
        .setScale(1, -0.75)
        .setAlpha(0);
      this.mirrorLogoContainer.add(refText);

      this.tweens.add({
        targets: refText,
        alpha: 0.22,
        duration: 500,
        delay: 250 + i * 50,
        ease: 'Cubic.easeOut',
      });
    }

    // 2. Thanh gương kính màu accent ở giữa mở rộng từ tâm
    const barContainer = this.add.container(0, 0);
    const barWidth = 470;
    const barHeight = 18;
    const barBg = this.add.graphics();
    // Đổ bóng thanh gương
    barBg.fillStyle(0x0b163a, 0.8);
    barBg.fillRoundedRect(360 - barWidth / 2, barY - barHeight / 2 + 5, barWidth, barHeight, 9);
    // Thân thanh gương mang màu accent
    barBg.fillStyle(accentColor, 1.0);
    barBg.fillRoundedRect(360 - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 9);
    barBg.lineStyle(3, 0x0b163a, 1.0);
    barBg.strokeRoundedRect(360 - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 9);
    // Vệt highlight trên gương
    barBg.fillStyle(0xffffff, 0.7);
    barBg.fillRoundedRect(360 - barWidth / 2 + 18, barY - barHeight / 2 + 3, 160, 4, 2);

    // Viên ngọc thoi vàng đính ở tâm thanh gương
    const centerJewel = this.add.graphics();
    const jewelPts = [
      new Phaser.Geom.Point(360, barY - 14),
      new Phaser.Geom.Point(374, barY),
      new Phaser.Geom.Point(360, barY + 14),
      new Phaser.Geom.Point(346, barY),
    ];
    centerJewel.fillStyle(0xffc94a, 1.0);
    centerJewel.fillPoints(jewelPts, true);
    centerJewel.lineStyle(3.5, 0x0b163a, 1.0);
    centerJewel.strokePoints(jewelPts, true);
    centerJewel.fillStyle(0xffffff, 0.9);
    centerJewel.fillCircle(360, barY, 2.5);

    barContainer.add([barBg, centerJewel]);
    barContainer.setScale(0, 1);
    this.mirrorLogoContainer.add(barContainer);

    this.tweens.add({
      targets: barContainer,
      scaleX: 1,
      duration: 550,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Flash lấp lánh tại tâm ngọc khi thanh gương bung mở
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 1.0);
        const r = 14;
        const inner = r * 0.28;
        const pts = [
          new Phaser.Geom.Point(360, barY - r),
          new Phaser.Geom.Point(360 + inner, barY - inner),
          new Phaser.Geom.Point(360 + r, barY),
          new Phaser.Geom.Point(360 + inner, barY + inner),
          new Phaser.Geom.Point(360, barY + r),
          new Phaser.Geom.Point(360 - inner, barY + inner),
          new Phaser.Geom.Point(360 - r, barY),
          new Phaser.Geom.Point(360 - inner, barY - inner),
        ];
        flash.fillPoints(pts, true);
        this.time.delayedCall(300, () => flash.destroy());
      },
    });

    // 3. Cụm chữ chính MIRROR: Face #FFC857, Highlight #FFF4D6, Extrusion #11204F / #0B163A
    for (let i = 0; i < letters.length; i++) {
      const item = letters[i];
      const x = 360 + item.dx;

      // Deep shadow / outer extrusion
      const shadowText = this.add
        .text(x, logoY - 50 + 7, item.char, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '76px',
          color: '#0B163A',
          stroke: '#0B163A',
          strokeThickness: 14,
        })
        .setOrigin(0.5)
        .setAngle(0)
        .setAlpha(0);

      // Mid extrusion (#11204F)
      const extrusionText = this.add
        .text(x, logoY - 50 + 3, item.char, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '76px',
          color: '#11204F',
          stroke: '#11204F',
          strokeThickness: 10,
        })
        .setOrigin(0.5)
        .setAngle(0)
        .setAlpha(0);

      // Main face (#FFC857)
      const mainText = this.add
        .text(x, logoY - 50, item.char, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '76px',
          color: '#FFC857',
          stroke: '#0B163A',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setAngle(0)
        .setAlpha(0);

      // Top highlight: #FFF4D6, 1px offset up-left
      const highlightText = this.add
        .text(x - 1, logoY - 50 - 1, item.char, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '76px',
          color: '#FFF4D6',
        })
        .setOrigin(0.5)
        .setAngle(0)
        .setAlpha(0);

      this.mirrorLogoContainer.add([shadowText, extrusionText, mainText, highlightText]);
      this.letterObjects.push({
        highlight: highlightText,
        main: mainText,
        extrusion: extrusionText,
        shadow: shadowText,
        baseY: logoY,
      });

      // Staggered drop & bounce
      this.tweens.add({
        targets: shadowText,
        y: logoY + 7,
        alpha: 1,
        angle: item.rot,
        duration: 520,
        delay: i * 70,
        ease: 'Back.easeOut',
      });

      this.tweens.add({
        targets: extrusionText,
        y: logoY + 3,
        alpha: 1,
        angle: item.rot,
        duration: 520,
        delay: i * 70,
        ease: 'Back.easeOut',
      });

      this.tweens.add({
        targets: mainText,
        y: logoY,
        alpha: 1,
        angle: item.rot,
        duration: 520,
        delay: i * 70,
        ease: 'Back.easeOut',
      });

      this.tweens.add({
        targets: highlightText,
        y: logoY - 1,
        alpha: 0.9,
        angle: item.rot,
        duration: 520,
        delay: i * 70,
        ease: 'Back.easeOut',
      });
    }

    // 4. Hoạt cảnh lặp (Idle Loop Animation)
    // A. Nhấp nhô bồng bềnh
    this.tweens.add({
      targets: this.mirrorLogoContainer,
      y: '-=4',
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // B. Lớp vẽ tia sáng tráng gương lướt qua (Light Sheen Sweep)
    this.logoSheenGraphics = this.add.graphics();
    this.mirrorLogoContainer.add(this.logoSheenGraphics);

    // C. Bộ đếm thời gian lặp tia sáng (mỗi 4.5s)
    this.time.addEvent({
      delay: 4500,
      loop: true,
      callback: () => this.playLogoSheenSweep(),
    });

    // D. Bộ đếm thời gian nhún nhảy tinh nghịch (mỗi 6.5s)
    this.time.addEvent({
      delay: 6500,
      loop: true,
      callback: () => this.playLetterJiggle(),
    });
  }

  /**
   * Quét tia sáng óng ánh ngang qua chữ MIRROR vàng và thanh gương
   */
  private playLogoSheenSweep(): void {
    if (!this.logoSheenGraphics) return;
    const sweep = { progress: -0.2 };
    this.tweens.add({
      targets: sweep,
      progress: 1.2,
      duration: 650,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        if (!this.logoSheenGraphics) return;
        this.logoSheenGraphics.clear();
        const curX = Phaser.Math.Linear(120, 600, sweep.progress);
        const yTop = 135;
        const yBottom = 265;

        // Dải sáng nghiêng 30 độ
        this.logoSheenGraphics.fillStyle(0xffffff, 0.4);
        this.logoSheenGraphics.beginPath();
        this.logoSheenGraphics.moveTo(curX - 22, yTop);
        this.logoSheenGraphics.lineTo(curX + 22, yTop);
        this.logoSheenGraphics.lineTo(curX - 10, yBottom);
        this.logoSheenGraphics.lineTo(curX - 54, yBottom);
        this.logoSheenGraphics.closePath();
        this.logoSheenGraphics.fillPath();

        // Lõi sáng rực rỡ
        this.logoSheenGraphics.fillStyle(0xffffff, 0.75);
        this.logoSheenGraphics.beginPath();
        this.logoSheenGraphics.moveTo(curX - 7, yTop);
        this.logoSheenGraphics.lineTo(curX + 7, yTop);
        this.logoSheenGraphics.lineTo(curX - 25, yBottom);
        this.logoSheenGraphics.lineTo(curX - 39, yBottom);
        this.logoSheenGraphics.closePath();
        this.logoSheenGraphics.fillPath();
      },
      onComplete: () => {
        this.logoSheenGraphics?.clear();
      },
    });
  }

  /**
   * Một chữ cái nhún nhảy nhẹ nhàng tạo nét vui tươi casual
   */
  private playLetterJiggle(): void {
    if (this.letterObjects.length === 0) return;
    const targets = [3, 4, 5]; // R, O, R
    const pick = targets[Math.floor(Math.random() * targets.length)];
    const letter = this.letterObjects[pick];
    if (!letter) return;

    this.tweens.add({
      targets: [letter.main, letter.highlight],
      y: letter.baseY - 10,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: [letter.extrusion, letter.shadow],
      y: letter.baseY + 7 - 10,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Thiết lập tương tác chạm bụi sao & sóng lượng tử khi người chơi ấn vào bầu trời
   */
  private setupCosmicSkyInteractions(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.spawnCosmicInteraction(pointer.worldX, pointer.worldY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const now = Date.now();
        if (now - this.lastTrailTime > 45) {
          this.lastTrailTime = now;
          this.spawnStardustTrail(pointer.worldX, pointer.worldY);
        }
      }
    });
  }

  /**
   * Tạo chùm bụi sao và sóng lượng tử tỏa ra từ điểm chạm
   */
  private spawnCosmicInteraction(x: number, y: number): void {
    this.game?.events?.emit('ethereal:ripple', x, y, COLOR_NUMBERS.gridFine);
    // 1. Sóng lượng tử (Cosmic Ripple) lan tỏa hình thoi (Diamond motif, glowTier 1)
    const tier1 = glowTier(1);
    const ripple = this.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 4);
    const rippleData = { radius: 8, alpha: tier1.alpha };
    this.tweens.add({
      targets: rippleData,
      radius: 65,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ripple.clear();
        ripple.lineStyle(2, COLOR_NUMBERS.icePrimary, rippleData.alpha);
        strokeDiamond(ripple, x, y, rippleData.radius);
        ripple.lineStyle(1.2, 0xffffff, rippleData.alpha * 0.7);
        strokeDiamond(ripple, x, y, rippleData.radius * 0.7);
      },
      onComplete: () => ripple.destroy(),
    });

    // 2. Chùm 7 hạt bụi sao phát quang bay tỏa ra
    const colors = [0xffd23f, 0x7fd8ff, 0xffffff, 0xffe899];
    for (let i = 0; i < 7; i++) {
      const p = this.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 5);
      const col = colors[i % colors.length];
      const r = 6 + Math.random() * 5;

      p.fillStyle(col, 1.0);
      p.beginPath();
      p.moveTo(0, -r);
      p.lineTo(r * 0.25, -r * 0.25);
      p.lineTo(r, 0);
      p.lineTo(r * 0.25, r * 0.25);
      p.lineTo(0, r);
      p.lineTo(-r * 0.25, r * 0.25);
      p.lineTo(-r, 0);
      p.lineTo(-r * 0.25, -r * 0.25);
      p.closePath();
      p.fillPath();

      p.setPosition(x, y);

      const angle = Math.random() * Math.PI * 2;
      const dist = 35 + Math.random() * 65;
      const targetX = x + Math.cos(angle) * dist;
      const targetY = y + Math.sin(angle) * dist;

      this.tweens.add({
        targets: p,
        x: targetX,
        y: targetY,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        rotation: (Math.random() > 0.5 ? 1 : -1) * Math.PI,
        duration: 480 + Math.random() * 250,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /**
   * Tạo vệt đuôi bụi sao khi người chơi vuốt lướt ngón tay
   */
  private spawnStardustTrail(x: number, y: number): void {
    const p = this.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 5);
    const col = Math.random() > 0.5 ? 0xffd23f : 0x7fd8ff;
    const r = 4 + Math.random() * 3;

    p.fillStyle(col, 0.9);
    p.fillCircle(0, 0, r);
    p.fillStyle(0xffffff, 1.0);
    p.fillCircle(0, 0, r * 0.4);
    p.setPosition(x, y);

    this.tweens.add({
      targets: p,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      y: y + 10,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    });
  }

  private openSettings(): void {
    new SettingsDialog(this, this.progressRepo).open();
  }

  private animateButtonTap(target: Phaser.GameObjects.GameObject, onComplete: () => void): void {
    this.tweens.add({
      targets: target,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 80,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete,
    });
  }

  private transitionParts(): Parts {
    return {
      emblem: this.emblem.graphics(),
      titleBlock: [this.titleBlock],
      primaryButton: [this.primaryButton],
      buttons: [this.primaryButton, this.secondaryButton],
      chrome: [this.titleBlock, this.secondaryButton, this.settingsButton, this.langPillContainer],
      corner: [this.settingsButton, this.langPillContainer],
    };
  }

  playIn(tl: TransitionTimeline, ctx: TransitionContext): void {
    applySteps(tl, menuIn(ctx.from === 'LevelSelectScene' ? 'map' : 'play'), this.transitionParts(), 'enter');
    this.galaxySky.setAlpha(0);
    this.galaxy.setAlpha(0);
    tl.at(250, this.galaxySky, { alpha: 1 }, 450, 'cubicOut');
    tl.at(250, this.galaxy, { alpha: 1 }, 550, 'cubicOut');
    if (this.deepStarsContainer) {
      this.deepStarsContainer.setAlpha(0);
      tl.at(250, this.deepStarsContainer, { alpha: 1 }, 550, 'cubicOut');
    }
    if (this.midStarsContainer) {
      this.midStarsContainer.setAlpha(0);
      tl.at(250, this.midStarsContainer, { alpha: 1 }, 550, 'cubicOut');
    }
    if (ctx.from === 'LevelSelectScene' && !isReducedMotion()) {
      const cam = this.cameras.main;
      const baseZoom = cam.zoom;
      const state = { zoom: baseZoom * 0.85 };
      cam.setZoom(state.zoom);
      tl.at(250, state, { zoom: baseZoom }, 550, 'cubicOut', () => cam.setZoom(state.zoom));
    }
  }

  playOut(tl: TransitionTimeline, ctx: TransitionContext): void {
    tl.at(100, this.galaxySky, { alpha: 0 }, 400, 'cubicInOut');
    if (this.deepStarsContainer) tl.at(100, this.deepStarsContainer, { alpha: 0 }, 400, 'cubicInOut');
    if (this.midStarsContainer) tl.at(100, this.midStarsContainer, { alpha: 0 }, 400, 'cubicInOut');
    tl.at(0, this.galaxy, { alpha: 0, scaleX: 1.4, scaleY: 1.4 }, 500, 'cubicInOut');
    if (ctx.route === 'menu-to-play') {
      applySteps(tl, MENU_OUT_TO_PLAY, this.transitionParts(), 'exit');
      tl.call(MENU_SPECIAL.spinAtMs, () => this.emblem.setRingSpeed(MENU_SPECIAL.spinPeak));
    } else {
      applySteps(tl, MENU_OUT_TO_MAP, this.transitionParts(), 'exit');
      // Spatial Zoom: Camera phóng nhẹ về phía trước như lao vào tâm vũ trụ
      if (!isReducedMotion()) {
        const cam = this.cameras.main;
        const baseZoom = cam.zoom;
        const zoomState = { zoom: baseZoom };
        tl.at(0, zoomState, { zoom: baseZoom * 1.25 }, 500, 'cubicInOut', () => {
          cam.setZoom(zoomState.zoom);
        });
      }
    }
  }

  override update(_time: number, delta: number): void {
    this.emblem.update(delta);
    const tilt = deviceTilt.getTilt();
    // 1. Lớp xa nhất (Deepest Layer): Những ngôi sao nhỏ nhỏ đậm màu di chuyển NHANH NHẤT
    if (this.deepStarsContainer) {
      this.deepStarsContainer.setPosition(tilt.x * 46, tilt.y * 38);
    }

    // 2. Lớp giữa (Middle Layer): Vùng thiên hà và sao tầm trung di chuyển NHANH HƠN CHÚT
    if (this.midStarsContainer) {
      this.midStarsContainer.setPosition(tilt.x * 20, tilt.y * 18);
    }
    if (this.galaxy) {
      this.galaxy.setPosition(360 + tilt.x * 20, this.layout.emblemY + tilt.y * 18);
    }
    // Lớp ngoài cùng: di chuyển chậm, đầm tay và ổn định
    const ex = 360 - tilt.x * 6;
    const ey = this.layout.emblemY - tilt.y * 5;
    this.emblem.graphics().forEach((g) => g.setPosition(ex, ey));

    for (const mote of this.ambientMotes) {
      mote.angle += mote.speed * (delta / 1000);
      const mx = ex + Math.cos(mote.angle) * mote.dist;
      const my = ey + Math.sin(mote.angle) * (mote.dist * 0.45) + mote.yOffset;
      mote.graphics.setPosition(mx, my);
    }
  }

  private createMenuParallaxLayers(width: number, height: number, theme: GalaxyTheme): void {
    // Both layers are baked into textures once; a Graphics with hundreds of circles is
    // re-triangulated every frame, an Image only moves.
    const pad = 60;
    const texW = width + pad * 2;
    const texH = height + pad * 2;

    // 1. Lớp xa nhất: 160 ngôi sao nhỏ xíu, giàu sắc độ thiên hà (amber, xanh lam, tím hồng), quét nhanh nhất
    const deepKey = ensureParallaxStarTexture(this, `menu_deep_stars_${theme.chapter}_${texW}x${texH}`, texW, texH, {
      count: 160,
      seed: 1103 + theme.chapter * 59,
      colors: [COLOR_NUMBERS.amberSolid, 0x7fb8ff, 0xcfe6ff, 0xff8fc8, 0x5c7cfa, theme.colors.accent, 0xffffff],
      minRadius: 0.7,
      maxRadius: 1.6,
      minAlpha: 0.45,
      maxAlpha: 0.95,
      coreChance: 0.35,
    });
    this.deepStarsContainer = this.add.container(0, 0).setDepth(-2);
    this.deepStarsContainer.add(this.add.image(-pad, -pad, deepKey).setOrigin(0));

    // 2. Lớp giữa: 48 ngôi sao sáng tầm trung có quầng sáng nhẹ
    const midKey = ensureParallaxStarTexture(this, `menu_mid_stars_${theme.chapter}_${texW}x${texH}`, texW, texH, {
      count: 48,
      seed: 5071 + theme.chapter * 17,
      colors: [theme.colors.accent, COLOR_NUMBERS.amberSolid, 0xffffff, 0xcfe6ff],
      minRadius: 1.6,
      maxRadius: 3.2,
      minAlpha: 0.55,
      maxAlpha: 0.95,
      halo: true,
      coreChance: 1,
    });
    this.midStarsContainer = this.add.container(0, 0).setDepth(-1.2);
    this.midStarsContainer.add(this.add.image(-pad, -pad, midKey).setOrigin(0));
  }

  private setupAmbientMotes(theme: GalaxyTheme): void {
    const colors = [theme.colors.accent, COLOR_NUMBERS.amberSolid, 0xffffff, COLOR_NUMBERS.iceHighlight];
    const dotKey = ensureSoftDotTexture(this);
    for (let i = 0; i < 14; i++) {
      const r = 1.6 + Math.random() * 2.2;
      const g = this.add.image(0, 0, dotKey)
        .setDepth(-0.5)
        .setDisplaySize(r * 2.6, r * 2.6)
        .setTint(colors[i % colors.length])
        .setAlpha(0.65 + Math.random() * 0.35);

      const dist = 110 + (i * 12) + Math.random() * 25;
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const speed = (0.2 + Math.random() * 0.25) * (i % 2 === 0 ? 1 : -1);
      const yOffset = (Math.random() - 0.5) * 30;

      this.ambientMotes.push({ graphics: g, dist, angle, speed, yOffset });
    }
  }

  private setupEmblemInteraction(theme: GalaxyTheme): void {
    const zone = this.add.zone(360, this.layout.emblemY, 260, 260).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      playUiCue(this, 'tap');
      this.game?.events?.emit('ethereal:ripple', pointer.worldX, pointer.worldY, theme.colors.accent, 160);

      // Nhịp thở đàn hồi nhẹ của biểu tượng
      const graphics = this.emblem.graphics();
      this.tweens.add({
        targets: graphics,
        scaleX: '*=1.06',
        scaleY: '*=1.06',
        duration: 220,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    });
  }
}
