import { getSafeStorage, memoryStorage } from '../../infrastructure/safeStorage.ts';
import Phaser from 'phaser';
import { campaignManifest } from '../../content/manifest.ts';
import { loadLevel } from '../../content/catalog.ts';
import { levelAccess, resolveMapCompletedLevels } from '../../domain/campaign.ts';
import type { LevelAccessMode } from '../../domain/campaign.ts';
import type { Chapter } from '../../domain/model.ts';
import { createProgressRepository } from '../../infrastructure/progressRepository.ts';
import type { ProgressRepository } from '../../application/progressPort.ts';
import { COLOR_NUMBERS, COLOR_TOKENS, LAYOUT_TOKENS, TYPO_TOKENS } from '../designTokens.ts';
import { TEXTURE_KEYS, TextureFactory } from '../TextureFactory.ts';
import { applyDesignViewport, designSafeArea, designViewBounds } from '../designViewport.ts';
import { bandArtPlacements, layoutCampaignMap, snapToRowGap, type ChapterBand } from '../galaxy/constellationLayout.ts';
import { walkedLinkAlpha } from '../galaxy/constellationMotion.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { NODE_SILHOUETTE_FIT, drawTargetSilhouette } from '../board/targetSilhouette.ts';
import { t, getChapterLabel, getChapterName, getGalaxyType } from '../i18n.ts';
import { director } from '../transitions/SceneDirector.ts';
import type { Choreographed, TransitionContext } from '../transitions/SceneDirector.ts';
import type { TransitionTimeline } from '../transitions/TransitionTimeline.ts';
import { applySteps, orderByDistance } from '../transitions/choreography.ts';
import type { Parts, Poseable } from '../transitions/choreography.ts';
import { MAP_OUT_TO_MENU, MAP_OUT_TO_PLAY, MAP_SPECIAL, mapIn } from '../transitions/routes.ts';
import { playUiCue } from '../audio/uiCues.ts';
import { GALAXY_THEMES, resolveGalaxyTheme, nodeAccent, teaserChapters } from '../galaxy/galaxyTheme.ts';
import { chapterRoman } from '../../content/chapters.ts';
import { ChapterEndlessGate } from '../galaxy/chapterEndlessGate.ts';
import { ENDLESS_UNLOCK_LEVEL, endlessGateState, galaxyCentreNear } from '../galaxy/endlessGateRules.ts';
import { getEndlessLevelNumber } from '../../content/endless/endlessCatalog.ts';
import { createGalaxyNodeBody, NODE_HALF, NODE_LABEL_Y, NODE_SCALE } from '../galaxy/galaxyNode.ts';
import { playBubbleBelow } from '../hud/playBubble.ts';
import { computeMapReveal } from '../galaxy/mapReveal.ts';
import type { MapReveal } from '../galaxy/mapReveal.ts';
import { addGalaxyArtwork, ensureLinkDotTexture, ensureMeteorTexture, ensureWhiteStarTexture, galaxyMapGradient, playGalaxyIntro, preloadGalaxyArtwork } from '../galaxy/GalaxyArtwork.ts';
import { createChapterTitleCard, type ChapterTitleCard } from '../galaxy/ChapterTitleCard.ts';
import { createSparkles, meteorPose, sparkleAlpha, type Sparkle } from '../galaxy/mapSparkle.ts';
import { setPcBackground } from '../sky/pcBackground.ts';
import { deviceTilt } from '../sky/deviceTilt.ts';
import { starTexture } from '../sky/starTexture.ts';
import { ensureParallaxStarTexture } from '../sky/parallaxStars.ts';
import { formatStarTotal, nodeStarRow, starTotals, type StarTotal } from '../galaxy/levelStars.ts';
import type { LevelResult } from '../../application/progressPort.ts';

type NodeInfo = {
  id: string;
  index: number;
  title: string;
  chapter: Chapter;
  x: number;
  y: number;
  state: 'completed' | 'current' | 'unlocked' | 'locked';
  available: boolean;
};


const METEOR_HEADING = Phaser.Math.DegToRad(35);
const METEOR_TRAVEL = 520;

export class LevelSelectScene extends Phaser.Scene implements Choreographed {
  readonly directorKey = 'LevelSelectScene' as const;
  private progressRepo!: ProgressRepository;
  private levelResults: Readonly<Record<string, LevelResult>> = {};
  private mapContainer!: Phaser.GameObjects.Container;
  private headerContainer!: Phaser.GameObjects.Container;
  private toastContainer?: Phaser.GameObjects.Container;
  private focusLevelId?: string;
  /** Dev-only: lift the fog so every band can be captured. */
  private revealAll = false;

  private nodeViews: Array<{ info: NodeInfo; container: Phaser.GameObjects.Container }> = [];
  private linkParts: Poseable[] = [];
  private tappedIndex: number | null = null;

  private mode: LevelAccessMode = 'campaign';
  private previewCompletedThrough?: string;

  private isDragging = false;
  private dragStartY = 0;
  private containerStartY = 0;
  private safe = { top: 0, right: 0, bottom: 0, left: 0 };
  private minY = -2000;
  private maxY = 0;
  private galaxyLayers: Array<{ art: Phaser.GameObjects.Container; y: number; reach: number }> = [];
  /** Each galaxy plays its arrival once, when it scrolls into view. */
  private artIntros: Array<{ y: number; art: Phaser.GameObjects.Container; played: boolean }> = [];
  /** Each chapter's title card plays once, when the middle of the screen enters the chapter. */
  private titleCards: Array<{ top: number; bottom: number; bannerY: number; rows: number[]; card: ChapterTitleCard; played: boolean }> = [];
  private chapterOneFx?: {
    band: { top: number; bottom: number };
    sparkles: Array<{ data: Sparkle; image: Phaser.GameObjects.Image }>;
    meteor: Phaser.GameObjects.Image;
    meteorOrigin?: { x: number; y: number };
    elapsedMs: number;
  };
  private backdropParts: Phaser.GameObjects.GameObject[] = [];
  private mapDeepStarsContainer?: Phaser.GameObjects.Container;
  private mapMidStarsContainer?: Phaser.GameObjects.Container;
  private chapterAtmosphereFx: Array<{
    chapter: number;
    band: { top: number; bottom: number };
    sparkles: Array<{ data: Sparkle; image: Phaser.GameObjects.Image }>;
    meteor?: Phaser.GameObjects.Image;
    meteorOrigin?: { x: number; y: number };
    elapsedMs: number;
  }> = [];
  private scrollVelocity = 0;
  private dragged = false;
  private fog?: Phaser.GameObjects.Graphics;
  private fogHint?: Phaser.GameObjects.Container;
  private revealLimitY = Number.POSITIVE_INFINITY;
  private celebrating = false;
  private pendingUnlock?: {
    chapter: Chapter;
    reveal: MapReveal;
    bannerY: number;
    firstNodeY: number;
    accent: number;
  };

  constructor() {
    super({ key: 'LevelSelectScene' });
  }

  preload(): void {
    preloadGalaxyArtwork(this, Object.values(GALAXY_THEMES).map((theme) => theme.id));
  }

  init(data: { mode?: LevelAccessMode; previewCompletedThrough?: string; focusLevelId?: string; revealAll?: boolean } = {}): void {
    this.mode = data.mode ?? 'campaign';
    this.previewCompletedThrough = this.mode === 'harness'
      ? data.previewCompletedThrough
      : undefined;
    this.focusLevelId = data.focusLevelId;
    // Temporary: the fog is lifted in every build so players can see the whole map. Restore
    // `data.revealAll ?? import.meta.env.DEV` to bring the sealed-chapter fog back.
    this.revealAll = data.revealAll ?? true;
  }

  create(): void {
    this.isDragging = false;
    this.dragged = false;
    this.scrollVelocity = 0;
    this.tappedIndex = null;
    this.celebrating = false;

    applyDesignViewport(this);
    this.safe = designSafeArea(this);
    // The header fade reaches safe.top + 136 and chapter 1's banner starts at 149: let the map rest that inset lower so a notch does not hide it.
    this.maxY = this.safe.top;
    TextureFactory.generateAll(this);

    this.progressRepo = createProgressRepository(getSafeStorage() ?? memoryStorage, campaignManifest, 'oracle-v2');
    const { progress } = this.progressRepo.read();
    this.levelResults = progress.levels;
    const mapCompleted = resolveMapCompletedLevels(
      campaignManifest,
      progress.completed,
      this.mode,
      this.previewCompletedThrough
    );

    // 2. Container bản đồ chòm sao có thể cuộn dọc
    this.mapContainer = this.add.container(0, 0).setDepth(10);

    // 3. Dựng chòm sao & đường nối Bezier
    const currentNode = this.buildConstellation(mapCompleted);

    // 4. Header cố định trên đỉnh có thanh tiến độ (Depth 80)
    this.headerContainer = this.add.container(0, 0).setDepth(80);
    this.buildHeader(starTotals(campaignManifest, this.levelResults));

    // 5. Cài đặt cuộn / kéo mượt mà
    this.setupScrolling();

    // 6. Tự động cuộn tới node hiện tại (Auto-scroll to current node)
    if (this.pendingUnlock) {
      // Reopen where the previous chapter ended; the fog lifts once the scene is in.
      this.mapContainer.y = this.minY;
      this.time.delayedCall(1100, () => this.playChapterUnlock());
    } else if (currentNode) {
      const idealY = Phaser.Math.Clamp(540 - currentNode.y, this.minY, this.maxY);
      this.mapContainer.y = idealY;
    }

    director.attach(this);
  }

  public goToMenu(): void {
    director.go(this, 'MenuScene', {}, { route: 'map-to-menu' });
  }

  private anchorIndex(): number {
    const current = this.nodeViews.findIndex((v) => v.info.state === 'current');
    return current >= 0 ? current : 0;
  }

  private transitionParts(anchor: number): Parts {
    const ordered = orderByDistance(this.nodeViews.map((v) => v.container), anchor);
    const tapped = this.nodeViews[anchor]?.container;
    return {
      header: [this.headerContainer],
      nodes: ordered,
      tappedNode: tapped ? [tapped] : [],
      otherNodes: ordered.filter((c) => c !== tapped),
      links: this.linkParts,
    };
  }

  playIn(tl: TransitionTimeline, ctx: TransitionContext): void {
    applySteps(tl, mapIn(ctx.from === 'PlayScene' ? 400 : 300), this.transitionParts(this.anchorIndex()), 'enter');
    // Spatial Zoom: Tiếp nối pha zoom vào không gian chòm sao từ Menu
    if (ctx.from === 'MenuScene' && !isReducedMotion()) {
      const cam = this.cameras.main;
      const baseZoom = cam.zoom;
      cam.setZoom(baseZoom * 1.25);
      const zoomState = { zoom: baseZoom * 1.25 };
      tl.at(250, zoomState, { zoom: baseZoom }, 500, 'cubicOut', () => {
        cam.setZoom(zoomState.zoom);
      });
    }
    for (const part of this.backdropParts) {
      const visual = part as Phaser.GameObjects.Image;
      visual.setAlpha(0);
      tl.at(250, visual, { alpha: 1 }, 500, 'cubicOut');
    }
  }

  playOut(tl: TransitionTimeline, ctx: TransitionContext): void {
    this.scrollVelocity = 0;
    for (const part of this.backdropParts) tl.at(0, part, { alpha: 0 }, 450, 'cubicInOut');
    if (ctx.route === 'map-to-play') {
      applySteps(tl, MAP_OUT_TO_PLAY, this.transitionParts(this.tappedIndex ?? this.anchorIndex()), 'exit');
      if (ctx.origin) this.expandRing(tl, ctx.origin);
    } else {
      applySteps(tl, MAP_OUT_TO_MENU, this.transitionParts(this.anchorIndex()), 'exit');
      if (!isReducedMotion()) {
        const cam = this.cameras.main;
        const state = { zoom: cam.zoom };
        tl.at(0, state, { zoom: cam.zoom * 0.85 }, 450, 'cubicInOut', () => cam.setZoom(state.zoom));
      }
    }
  }

  /** Vòng sáng lan từ node vừa bấm tới bao trọn vị trí tấm bia của màn chơi */
  private expandRing(tl: TransitionTimeline, origin: { x: number; y: number }): void {
    const b = LAYOUT_TOKENS.board;
    const corners = [
      [b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height],
    ];
    const maxRadius = Math.max(...corners.map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
    const ring = this.add.graphics().setDepth(200);
    const state = { radius: MAP_SPECIAL.ringStartRadius, alpha: 0.9 };
    const draw = () => {
      ring.clear();
      ring.fillStyle(COLOR_NUMBERS.icePrimary, state.alpha * 0.12);
      ring.fillCircle(origin.x, origin.y, state.radius);
      ring.lineStyle(3, COLOR_NUMBERS.icePrimary, state.alpha);
      ring.strokeCircle(origin.x, origin.y, state.radius);
    };
    draw();
    tl.at(0, state, { radius: maxRadius, alpha: 0.3 }, MAP_SPECIAL.ringMs, 'cubicOut', draw);
  }

  private buildHeader(stars: StarTotal): void {
    // Header phủ từ mép trên thật xuống, kể cả phần dưới notch: nền phải liền
    // tới y=0 chứ không chỉ từ lề an toàn, nếu không sẽ hở một dải trời ở trên.
    const top = this.safe.top;
    const view = designViewBounds(this);

    // Nền header mờ dần xuống dưới (Soft gradient fade thay cho kẻ ngang)
    const headerBg = this.add.graphics();
    // Kept light so the map shows through on phones (notch inset adds to `top`).
    const HEADER_ALPHA = 0.8;
    const FADE_H = 24;
    headerBg.fillStyle(COLOR_NUMBERS.skyTop, HEADER_ALPHA);
    headerBg.fillRect(0, 0, view.width, top + 96);

    for (let h = 0; h < FADE_H; h++) {
      const alpha = HEADER_ALPHA * (1 - h / FADE_H);
      headerBg.fillStyle(COLOR_NUMBERS.skyTop, alpha);
      headerBg.fillRect(0, top + 96 + h, view.width, 1);
    }

    // Nút Menu tròn 80px (Vùng chạm 96px, chuẩn 1dp = 2px)
    const backBtn = this.add
      .image(56, top + 56, TEXTURE_KEYS.btnCircle80)
      .setSize(96, 96)
      .setInteractive({ useHandCursor: true });
    const backIcon = this.add.image(56, top + 56, TEXTURE_KEYS.iconMenuBack).setScale(1.25);
    backBtn.on('pointerup', () => {
      playUiCue(this, 'tap');
      this.goToMenu();
    });

    // Tiêu đề trang 32px serif
    const headerTitle = this.add
      .text(360, top + 56, t('level_select_title'), {
        fontFamily: TYPO_TOKENS.fontFamily.serif,
        fontSize: '32px',
        color: COLOR_TOKENS.text.primary,
      })
      .setOrigin(0.5);

    // Star total in the top-right pill (mockup LevelStars: "★ 96/144", gold rim)
    const progressText = this.add
      .text(0, 0, formatStarTotal(stars), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '24px',
        color: '#FFE29A',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);
    const icon = this.add.image(0, 0, starTexture(this, 'lit', 15)).setOrigin(0, 0.5);
    const pillW = Math.ceil(10 + icon.width + 8 + progressText.width + 18);
    const pillH = 56;
    const progressPill = this.add.container(720 - 24 - pillW / 2, top + 56);
    const pillBg = this.add.graphics();
    pillBg.fillStyle(0x141850, 0.7);
    pillBg.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
    pillBg.lineStyle(2.5, COLOR_NUMBERS.amberSolid, 1);
    pillBg.strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
    icon.setX(-pillW / 2 + 10);
    progressText.setX(icon.x + icon.width + 8);
    progressPill.add([pillBg, icon, progressText]);
    // The wider star pill pushes the title off centre: sit it between the back button and the pill.
    headerTitle.setX((112 + progressPill.x - pillW / 2) / 2);

    this.headerContainer.add([headerBg, backBtn, backIcon, headerTitle, progressPill]);
  }

  private buildConstellation(completedLevels: readonly string[]): NodeInfo | null {
    this.nodeViews = [];
    this.linkParts = [];
    this.galaxyLayers = [];
    this.backdropParts = [];
    this.chapterOneFx = undefined;
    this.artIntros = [];
    this.titleCards = [];

    // 1. Toạ độ nút và dải chương suy ra từ manifest (constellationLayout.ts)
    const layout = layoutCampaignMap(campaignManifest, teaserChapters(campaignManifest));
    const nodes: NodeInfo[] = layout.nodes.map((mapNode) => {
      const access = levelAccess(campaignManifest, completedLevels, mapNode.id, this.mode);
      let state: NodeInfo['state'] = 'locked';
      if (access.completed) {
        state = 'completed';
      } else if (access.unlocked && access.available) {
        state = 'current';
      } else if (access.unlocked && !access.available) {
        state = 'unlocked';
      }

      return {
        id: mapNode.id,
        index: mapNode.index,
        title: mapNode.title,
        chapter: mapNode.chapter,
        x: mapNode.x,
        y: mapNode.y,
        state,
        available: access.available,
      };
    });
    const currentNode = nodes.find((n) => n.state === 'current') ?? null;

    // 2. Sắc độ dải thiên hà riêng cho từng chương (Galaxy Theme Bands)
    const sky = this.add.image(0, 0, galaxyMapGradient(this, layout.chapters, layout.totalHeight))
      .setOrigin(0).setDisplaySize(720, layout.totalHeight);
    this.mapContainer.add(sky);
    this.backdropParts.push(sky);
    this.createMapParallaxLayers(layout.totalHeight, layout.chapters);
    for (const band of layout.chapters) {
      const gTheme = resolveGalaxyTheme(band.chapter);
      for (const place of bandArtPlacements(band)) {
        const art = addGalaxyArtwork(this, gTheme, place.x, place.y, place.size, { rx: 295, ry: 375 }, place.look, true);
        if (place.look) art.setAngle(place.look.angle).setScale(1, place.look.scaleY);
        this.mapContainer.add(art);
        // Coil galaxies carry the path, so they drift less against their nodes.
        this.galaxyLayers.push({ art, y: place.y, reach: band.art ? 24 : 65 });
        this.backdropParts.push(art);
        this.artIntros.push({ y: place.y, art, played: false });
      }
      const card = createChapterTitleCard(this, 360, band.bannerY, {
        chapter: band.chapter,
        roman: chapterRoman(band.chapter),
        name: getChapterName(band.chapter, gTheme.name),
        subtitle: getGalaxyType(band.chapter, gTheme.galaxyType),
        accent: gTheme.colors.accent,
        accentHex: gTheme.colors.accentHex,
      });
      const rows = layout.nodes.filter((n) => n.chapter === band.chapter).map((n) => n.y);
      this.titleCards.push({ top: band.top, bottom: band.bottom, bannerY: band.bannerY, rows, card, played: false });
    }

    this.addChapterAtmosphereFx(layout.chapters);

    // 3. Vẽ các đường cong Bezier mềm mại kết nối chòm sao (B3)
    // Dots are sprites: a Graphics holding thousands of fillCircle calls costs earcut time every frame.
    const linkLayer = this.add.container(0, 0);
    const linesGraphics = this.add.graphics();
    const dotKey = ensureLinkDotTexture(this);
    linkLayer.add(linesGraphics);
    this.mapContainer.add(linkLayer);
    this.linkParts.push(linkLayer);

    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];

      // Xác định trạng thái đoạn đường:
      // Đoạn đã đi: p1 đã hoàn thành và p2 đã hoàn thành (hoặc p2 là current)
      const isPathWalked = p1.state === 'completed' && (p2.state === 'completed' || p2.state === 'current');

      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(p1.x, p1.y),
        new Phaser.Math.Vector2((p1.x + p2.x) / 2 + (p1.x > p2.x ? 25 : -25), (p1.y + p2.y) / 2),
        new Phaser.Math.Vector2(p2.x, p2.y)
      );

      const points = curve.getPoints(24);

      // Chuẩn GalaxyKit: đoạn đã đi là dải vàng kem có quầng accent, đoạn chưa tới là chấm trắng mờ
      if (isPathWalked) {
        const alpha = walkedLinkAlpha(p2.state === 'current');
        const accent = resolveGalaxyTheme(p1.chapter).colors.accent;

        linesGraphics.lineStyle(13, accent, 0.28 * alpha);
        linesGraphics.strokePoints(points, false);
        linesGraphics.lineStyle(5.5, 0xffe7a6, alpha);
        linesGraphics.strokePoints(points, false);
      } else {
        let carry = 0;
        for (let j = 0; j < points.length - 1; j++) {
          const a = points[j];
          const b = points[j + 1];
          const len = Phaser.Math.Distance.BetweenPoints(a, b);
          let d = carry;
          for (; d < len; d += 13) {
            linkLayer.add(this.add.image(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, dotKey).setDisplaySize(4.4, 4.4).setAlpha(0.45));
          }
          carry = d - len;
        }
      }
    }

    // 4. Banner phân đoạn Chương phong cách Viên Thuốc Kính Phát Quang (Galaxy Chapter Pill)
    // Chuẩn mockup: GalaxyMap.dc.html
    for (const band of layout.chapters) {
      const gTheme = resolveGalaxyTheme(band.chapter);
      const chContainer = this.add.container(360, band.bannerY);

      const pillWidth = 330;
      const pillHeight = 72;
      const pillRadius = 26;

      // Hai đường line phát quang kéo dài sang 2 bên
      const wingLines = this.add.graphics();
      wingLines.lineStyle(1.6, gTheme.colors.accent, 0.7);
      wingLines.lineBetween(-320, 0, -pillWidth / 2 - 8, 0);
      wingLines.lineBetween(pillWidth / 2 + 8, 0, 320, 0);

      // Thân viên thuốc kính
      const pillBg = this.add.graphics();
      pillBg.fillStyle(gTheme.colors.accentDark, 0.78);
      pillBg.fillRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, pillRadius);
      pillBg.lineStyle(2, gTheme.colors.accent, 0.95);
      pillBg.strokeRoundedRect(-pillWidth / 2, -pillHeight / 2, pillWidth, pillHeight, pillRadius);

      const isTeaser = band.nodeCount === 0;
      const mainTitle = this.add
        .text(0, -13, getChapterLabel(band.chapter, gTheme.name), {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '22px',
          color: '#FFFFFF',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const gType = getGalaxyType(band.chapter, gTheme.galaxyType);
      const subStyle = {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '16px',
        color: gTheme.colors.accentHex,
        fontStyle: 'bold',
      };
      chContainer.add([wingLines, pillBg, mainTitle]);
      if (isTeaser) {
        chContainer.add(this.add.text(0, 17, `${gType} · ${t('map_coming_soon')}`, subStyle).setOrigin(0.5));
      } else {
        // Mockup LevelStars: "Dwarf galaxy · ★ 14/30", the chapter's stars over three per level.
        const lead = this.add.text(0, 17, `${gType} ·`, subStyle).setOrigin(0, 0.5);
        const star = this.add.image(0, 17, starTexture(this, 'lit', 11)).setOrigin(0, 0.5);
        const count = this.add
          .text(0, 17, formatStarTotal(starTotals(campaignManifest, this.levelResults, band.chapter)), subStyle)
          .setOrigin(0, 0.5);
        const gap = 6;
        let x = -(lead.width + gap + star.width + gap + count.width) / 2;
        for (const part of [lead, star, count]) {
          part.setX(x);
          x += part.width + gap;
        }
        chContainer.add([lead, star, count]);
      }
      this.mapContainer.add(chContainer);
      this.linkParts.push(chContainer);
    }

    // 5. Render từng Node màn chơi theo GalaxyKit: thân thoi + số màn bên dưới
    for (const node of nodes) {
      const nodeContainer = this.add.container(node.x, node.y);
      const nodeTheme = resolveGalaxyTheme(node.chapter);
      const bodyState = node.state === 'completed' ? 'completed' : node.state === 'current' ? 'current' : 'locked';
      nodeContainer.add(createGalaxyNodeBody(this, bodyState, nodeAccent(nodeTheme, node.id)));
      if (node.state === 'current') this.addCurrentNodePulse(nodeContainer, nodeAccent(nodeTheme, node.id));

      // Vùng chạm 96x96px, tách khỏi phần hiển thị
      const nodeSprite = this.add
        .zone(0, 0, 96, 96)
        .setInteractive({ useHandCursor: node.state !== 'locked' });
      nodeContainer.add(nodeSprite);

      const caption = (color: string, alpha = 1): Phaser.GameObjects.Text => this.add
        .text(0, NODE_LABEL_Y, node.id, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: `${Math.round(14 * NODE_SCALE)}px`,
          color,
          fontStyle: 'bold',
          stroke: '#120E36',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);

      if (node.state === 'completed') {
        // The node shows what the player built. Colours invert against the
        // amber diamond: solid parity reads navy, hollow parity reads amber.
        const silhouette = this.add.graphics();
        try {
          drawTargetSilhouette(
            silhouette,
            loadLevel(node.id, this.mode),
            NODE_SILHOUETTE_FIT,
            { filled: COLOR_NUMBERS.navyBackdrop, hollow: COLOR_NUMBERS.amberSolid }
          );
          nodeContainer.add(silhouette);
        } catch {
          // Level JSON missing or unavailable in this mode: the node still
          // reads as completed from its gold body.
          silhouette.destroy();
        }
        nodeContainer.add(caption('#FFFFFF'));
        // Best stars under the id; a completion saved before stars existed shows three empty slots.
        for (const star of nodeStarRow(this.levelResults[node.id]?.stars ?? 0)) {
          nodeContainer.add(this.add.image(star.dx, star.dy, starTexture(this, star.lit ? 'lit' : 'slot', star.outer)));
        }
      } else if (node.state === 'current') {
        nodeContainer.add(caption('#FFFFFF'));

        // "Play" bubble above the current node (mockup "Chọn màn · số sao mỗi màn").
        const K = NODE_SCALE;
        const bubbleW = 108 * K;
        const bubbleH = 30 * K;
        const tipY = -(NODE_HALF + 10 * K);
        const aboveY = tipY - 7 * K - bubbleH / 2;
        const below = playBubbleBelow(node.x, node.y, { halfW: bubbleW / 2, top: aboveY - bubbleH / 2, bottom: tipY }, layout.chapters.map((band) => band.bannerY));
        // Below: under the id caption, tail pointing up at the node.
        const bubble = this.add.container(0, below ? NODE_LABEL_Y + 20 * K + bubbleH / 2 : aboveY);
        const bubbleBg = this.add.graphics();
        bubbleBg.fillStyle(0xfff6da, 1);
        bubbleBg.lineStyle(2.5 * K, 0x5ad1e0, 1);
        bubbleBg.fillRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
        bubbleBg.strokeRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, bubbleH / 2);
        if (below) bubbleBg.fillTriangle(-6 * K, -bubbleH / 2 + 1, 6 * K, -bubbleH / 2 + 1, 0, -bubbleH / 2 - 7 * K);
        else bubbleBg.fillTriangle(-6 * K, bubbleH / 2 - 1, 6 * K, bubbleH / 2 - 1, 0, bubbleH / 2 + 7 * K);
        const bubbleText = this.add
          .text(0, 0, t('map_play'), {
            fontFamily: TYPO_TOKENS.fontFamily.display,
            fontSize: `${Math.round(14 * K)}px`,
            color: '#1A1446',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        bubble.add([bubbleBg, bubbleText]);
        nodeContainer.add(bubble);

        if (!isReducedMotion()) {
          this.tweens.add({
            targets: bubble,
            y: bubble.y - 4 * K,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      } else {
        nodeContainer.add(caption('#B9B6E8'));
        if (node.state === 'unlocked') {
          // Say it before the tap, in the same words the toast uses after it.
          nodeContainer.add(
            this.add
              .text(0, NODE_LABEL_Y + 32, t('toast_level_polishing', { id: node.id }), {
                fontFamily: TYPO_TOKENS.fontFamily.sans,
                fontSize: '16px',
                color: COLOR_TOKENS.text.secondary,
              })
              .setOrigin(0.5)
              .setAlpha(0.75)
          );
        }
      }

      // Xử lý sự kiện chạm
      nodeSprite.on('pointerup', () => {
        if (this.dragged || this.celebrating || node.y > this.revealLimitY - 40) return;
        if (node.state === 'locked') {
          playUiCue(this, 'locked');
          this.showToast(t('toast_level_locked', { id: node.id }));
        } else if (!node.available) {
          playUiCue(this, 'locked');
          this.showToast(t('toast_level_polishing', { id: node.id }));
        } else {
          playUiCue(this, 'node');
          this.tappedIndex = this.nodeViews.findIndex((v) => v.info.id === node.id);
          director.go(this, 'PlayScene', {
            levelId: node.id,
            mode: this.mode,
            previewCompletedThrough: this.previewCompletedThrough,
          }, {
            route: 'map-to-play',
            origin: { x: node.x, y: node.y + this.mapContainer.y },
          });
        }
      });

      this.mapContainer.add(nodeContainer);
      this.nodeViews.push({ info: node, container: nodeContainer });
    }

    // 6. Cổng vũ trụ Ải Vô Tận (Endless Gate) đặt ở cuối mỗi chương và luôn hiện;
    // mở sau 1-10 (endlessGateRules.ts). Chuẩn mockup: GalaxyMap.dc.html
    // The link starts at the level that opens the gate. Chapter 1 hangs it beside 1-10; chapter 2
    // has no gate until it ships an endless pool.
    const chapterTails = [1].map(chapter => ({
      chapter,
      lastNodeId: ENDLESS_UNLOCK_LEVEL[chapter],
    }));

    for (const tail of chapterTails) {
      const tailNode = nodes.find((n) => n.id === tail.lastNodeId);
      if (tailNode) {
        const gateTheme = resolveGalaxyTheme(tail.chapter);
        const heart = galaxyCentreNear(layout.chapters.find((b) => b.chapter === tail.chapter)?.art, tailNode.y);
        const gateX = heart ? heart.x : 110;
        const gateY = heart ? heart.y : tailNode.y;

        // Đường nhánh nét đứt nối từ nút cuối sang cổng
        const connector = this.add.graphics();
        connector.lineStyle(2, gateTheme.colors.accent, 0.65);
        const curve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(tailNode.x, tailNode.y),
          new Phaser.Math.Vector2((tailNode.x + gateX) / 2, tailNode.y + 40),
          new Phaser.Math.Vector2(gateX, gateY)
        );
        const pts = curve.getPoints(16);
        for (let j = 0; j < pts.length - 1; j += 2) {
          connector.lineBetween(pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
        }
        this.mapContainer.add(connector);

        const gate = endlessGateState(tail.chapter, completedLevels, this.mode === 'harness');
        const isUnlocked = gate.open;
        const endlessLevel = getEndlessLevelNumber(tail.chapter);
        const badgeText = isUnlocked
          ? `${t('gate_endless')} ${endlessLevel}`
          : t('gate_locked');

        const endlessGate = new ChapterEndlessGate(this, {
          x: gateX,
          y: gateY,
          theme: gateTheme,
          badgeText,
          // The look follows the unlock level; tapping still needs an endless pool (isUnlocked).
          isUnlocked: gate.reached,
          onPointerUp: () => {
            if (this.dragged || this.celebrating || endlessGate.y > this.revealLimitY - 40) return;
            if (isUnlocked) {
              playUiCue(this, 'node');
              director.go(this, 'PlayScene', {
                mode: 'endless',
                chapter: tail.chapter,
                endlessLevel,
              }, {
                route: 'map-to-play',
                origin: { x: gateX, y: gateY + this.mapContainer.y },
              });
            } else {
              playUiCue(this, 'locked');
              // Reached but no endless pool yet: say it is coming rather than asking for a level already cleared.
              this.showToast(gate.reached ? t('gate_coming_soon') : t('toast_level_locked', { id: gate.unlockLevelId }));
            }
          },
        });
        endlessGate.setScale(NODE_SCALE);
        this.mapContainer.add(endlessGate);
        this.linkParts.push(endlessGate);
      }
    }

    // Chỉ khám phá tới nửa chương dưới màn đang chơi; phần còn lại bị sương che tới khi mở khóa
    const frontier = nodes.find((n) => n.state !== 'completed') ?? null;
    setPcBackground(frontier?.chapter ?? nodes[nodes.length - 1]?.chapter ?? 1);
    const minReach = designViewBounds(this).height - 80;
    const reach = (r: MapReveal): MapReveal => ({ ...r, limitY: Math.max(r.limitY, minReach) });
    let reveal = reach(computeMapReveal(layout, frontier?.id ?? null));
    this.pendingUnlock = undefined;
    if (frontier && this.mode === 'campaign' && this.consumeChapterUnlock(frontier.chapter) && frontier.index > 0) {
      const band = layout.chapters.find((entry) => entry.chapter === frontier.chapter);
      if (band) {
        this.pendingUnlock = {
          chapter: frontier.chapter,
          reveal,
          bannerY: band.bannerY,
          firstNodeY: frontier.y,
          accent: resolveGalaxyTheme(frontier.chapter).colors.accent,
        };
        reveal = reach(computeMapReveal(layout, nodes[frontier.index - 1].id));
      }
    }
    if (this.revealAll) {
      this.pendingUnlock = undefined;
      reveal = { limitY: layout.totalHeight, chapterTail: false, sealedUntilChapter: null };
    }
    // Title cards float above the nodes but stay under the fog.
    for (const entry of this.titleCards) this.mapContainer.add(entry.card.container);
    this.buildFog(reveal, layout.totalHeight);
    this.applyReveal(reveal, layout.totalHeight);

    // Dev có thể cuộn tới màn bất kỳ qua ?focus=<id>; mặc định là màn hiện tại
    const focusNode = this.focusLevelId ? nodes.find((n) => n.id === this.focusLevelId) : undefined;
    return focusNode ?? currentNode;
  }

  private applyReveal(reveal: MapReveal, totalHeight: number): void {
    this.revealLimitY = reveal.limitY;
    const reach = Math.min(totalHeight, reveal.limitY + 60);
    this.minY = Math.min(0, designViewBounds(this).height - reach);
  }

  /** Fog over everything beyond the reveal limit, with a note on what lifts it. */
  private buildFog(reveal: MapReveal, totalHeight: number): void {
    this.fog?.destroy();
    this.fogHint?.destroy();
    this.fog = undefined;
    this.fogHint = undefined;
    if (reveal.limitY >= totalHeight) return;

    const fogColor = 0x050818;
    const fadeTop = reveal.limitY - 140;
    const fog = this.add.graphics();
    const bands = 28;
    for (let i = 0; i < bands; i++) {
      fog.fillStyle(fogColor, 0.97 * Math.pow((i + 1) / bands, 1.4));
      fog.fillRect(0, fadeTop + (i * 140) / bands, 720, 140 / bands + 1);
    }
    fog.fillStyle(fogColor, 0.97);
    fog.fillRect(0, reveal.limitY, 720, totalHeight - reveal.limitY);
    this.mapContainer.add(fog);
    this.fog = fog;

    const theme = resolveGalaxyTheme(reveal.sealedUntilChapter ?? 1);
    const message = reveal.chapterTail && reveal.sealedUntilChapter
      ? t('map_sealed_chapter', { chapter: `${t('chapter_prefix')} ${chapterRoman(reveal.sealedUntilChapter)}` })
      : t('map_sealed_continue');
    const hint = this.add.container(360, reveal.limitY - 52);
    const bg = this.add.graphics();
    bg.fillStyle(0x120e36, 0.85);
    bg.fillRoundedRect(-250, -26, 500, 52, 26);
    bg.lineStyle(2, theme.colors.accent, 0.7);
    bg.strokeRoundedRect(-250, -26, 500, 52, 26);
    const lock = this.add.graphics();
    lock.fillStyle(0xb9b6e8, 1);
    lock.fillRoundedRect(-228, -2, 18, 14, 4);
    lock.lineStyle(3.5, 0xb9b6e8, 1);
    lock.beginPath();
    lock.moveTo(-225, -2);
    lock.lineTo(-225, -8);
    lock.arc(-219, -8, 6, Math.PI, Math.PI * 2, false);
    lock.lineTo(-213, -2);
    lock.strokePath();
    const text = this.add
      .text(12, 0, message, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '19px',
        color: '#E4E8FF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    hint.add([bg, lock, text]);
    this.mapContainer.add(hint);
    this.fogHint = hint;
    if (!isReducedMotion()) {
      this.tweens.add({ targets: hint, alpha: 0.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /**
   * True once per chapter, the first time the map opens with that chapter as
   * the frontier. The first ever visit just records the chapter silently, so
   * existing saves do not replay old unlocks.
   */
  private consumeChapterUnlock(chapter: Chapter): boolean {
    const key = 'nozvi.mapUnlockSeen';
    try {
      const raw = localStorage.getItem(key);
      const seen = raw === null ? null : Number(raw);
      if (seen !== null && seen >= chapter) return false;
      localStorage.setItem(key, String(chapter));
      return seen !== null;
    } catch {
      return false;
    }
  }

  /** Fog lifts, a burst opens the new chapter's banner, and the map glides down into it. */
  private playChapterUnlock(): void {
    const unlock = this.pendingUnlock;
    this.pendingUnlock = undefined;
    if (!unlock) return;
    this.celebrating = true;
    this.scrollVelocity = 0;
    const toastText = t('map_chapter_unlocked', { chapter: getChapterLabel(unlock.chapter) });
    const finish = () => {
      this.celebrating = false;
      this.showToast(toastText);
    };

    this.applyReveal(unlock.reveal, Number.POSITIVE_INFINITY);
    const targetY = Phaser.Math.Clamp(540 - unlock.firstNodeY, this.minY, this.maxY);
    playUiCue(this, 'open');
    const fading = [this.fog, this.fogHint].filter((o): o is NonNullable<typeof o> => o !== undefined);
    if (isReducedMotion()) {
      fading.forEach((o) => o.destroy());
      this.mapContainer.y = targetY;
      finish();
      return;
    }

    const burst = this.add.graphics();
    this.mapContainer.add(burst);
    const state = { radius: 30, alpha: 0.9 };
    const draw = () => {
      burst.clear();
      burst.fillStyle(unlock.accent, state.alpha * 0.15);
      burst.fillCircle(360, unlock.bannerY, state.radius);
      burst.lineStyle(4, unlock.accent, state.alpha);
      burst.strokeCircle(360, unlock.bannerY, state.radius);
      burst.lineStyle(2, 0xffffff, state.alpha);
      burst.strokeCircle(360, unlock.bannerY, state.radius * 0.7);
    };
    draw();
    this.tweens.add({
      targets: state,
      radius: 520,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onUpdate: draw,
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: fading,
      alpha: 0,
      duration: 800,
      onComplete: () => fading.forEach((o) => o.destroy()),
    });
    this.tweens.add({
      targets: this.mapContainer,
      y: targetY,
      delay: 450,
      duration: 1500,
      ease: 'Cubic.easeInOut',
      onComplete: finish,
    });
  }

  private setupScrolling(): void {
    this.isDragging = false;
    this.dragged = false;
    this.scrollVelocity = 0;

    // worldY chứ không phải y: camera có zoom nên toạ độ màn hình không còn
    // trùng toạ độ thiết kế, dùng nhầm thì ngưỡng header và quãng cuộn đều lệch.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY > this.safe.top + 100 && !this.celebrating) {
        this.game?.events?.emit('ethereal:ripple', pointer.x, pointer.y, COLOR_NUMBERS.gridFine, 85);
        this.isDragging = true;
        this.dragged = false;
        this.scrollVelocity = 0;
        this.dragStartY = pointer.worldY;
        this.containerStartY = this.mapContainer.y;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) {
        this.isDragging = false;
        return;
      }
      if (this.isDragging) {
        const dy = pointer.worldY - this.dragStartY;
        if (Math.abs(dy) > 12) this.dragged = true;
        let targetY = this.containerStartY + dy;
        targetY = Phaser.Math.Clamp(targetY, this.minY, this.maxY);
        this.scrollVelocity = targetY - this.mapContainer.y;
        this.mapContainer.y = targetY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('pointerupoutside', () => {
      this.isDragging = false;
    });

    if (typeof window !== 'undefined') {
      const onGlobalUp = () => {
        this.isDragging = false;
      };
      window.addEventListener('pointerup', onGlobalUp);
      window.addEventListener('mouseup', onGlobalUp);
      window.addEventListener('blur', onGlobalUp);
      this.events.once('shutdown', () => {
        window.removeEventListener('pointerup', onGlobalUp);
        window.removeEventListener('mouseup', onGlobalUp);
        window.removeEventListener('blur', onGlobalUp);
      });
    }

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.mapContainer.y = Phaser.Math.Clamp(this.mapContainer.y - dy, this.minY, this.maxY);
    });
  }

  update(_time: number, delta: number): void {
    if (!this.mapContainer) return;
    if (this.isDragging && !this.input.activePointer?.isDown) {
      this.isDragging = false;
    }
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.1) {
      this.mapContainer.y = Phaser.Math.Clamp(this.mapContainer.y + this.scrollVelocity * Math.min(delta / 16.67, 3), this.minY, this.maxY);
      this.scrollVelocity *= Math.pow(0.90, delta / 16.67);
    }
    this.updateChapterAtmosphereFx(delta);
    const viewHeight = designViewBounds(this).height;
    // Wait for the scene's own fade-in so the arrival is seen, not played underneath it.
    if (!director.isTransitioning()) {
      for (const intro of this.artIntros) {
        const screenY = intro.y + this.mapContainer.y;
        if (intro.played || screenY < -viewHeight * 0.3 || screenY > viewHeight - 140) continue;
        intro.played = true;
        playGalaxyIntro(intro.art);
      }
      // The chapter the player is looking at introduces itself first; others follow as they scroll in.
      const centre = viewHeight / 2 - this.mapContainer.y;
      for (const entry of this.titleCards) {
        if (entry.played || centre < entry.top || centre >= entry.bottom) continue;
        entry.played = true;
        // A little below the gap's middle: the numeral clears the level above, and the short subtitle slots between the next row's side nodes.
        entry.card.container.setY(snapToRowGap(Phaser.Math.Clamp(centre, entry.bannerY + 150, entry.bottom - 200), entry.rows) + 46);
        entry.card.play();
      }
    }
    const tilt = deviceTilt.getTilt();
    // 1. Lớp xa nhất (Deepest Layer): Những ngôi sao nhỏ nhỏ đậm màu di chuyển NHANH NHẤT
    if (this.mapDeepStarsContainer) {
      this.mapDeepStarsContainer.setPosition(tilt.x * 44, tilt.y * 36);
    }
    // 2. Lớp giữa (Middle Layer): Bụi sao lấp lánh & thiên hà di chuyển VỪA PHẢI
    if (this.mapMidStarsContainer) {
      this.mapMidStarsContainer.setPosition(tilt.x * 20, tilt.y * 16);
    }
    for (const layer of this.galaxyLayers) {
      const screenY = layer.y + this.mapContainer.y;
      layer.art.x = 360 + tilt.x * 20;
      layer.art.y = layer.y - Phaser.Math.Clamp((screenY - designViewBounds(this).height / 2) * 0.12, -layer.reach, layer.reach) + tilt.y * 16;
      layer.art.setVisible(screenY > -800 && screenY < designViewBounds(this).height + 800);
    }
  }

  /** Twinkling stars and an occasional shooting star over the chapter 1 haze. */
  private createMapParallaxLayers(totalHeight: number, _chapters: readonly ChapterBand[]): void {
    // 1. Lớp xa nhất (Depth -2): sao nhỏ xíu, màu sắc phong phú quét nhanh nhất.
    // One 840x2048 tile baked once and repeated down the map: a Graphics with thousands of
    // circles is re-triangulated (earcut) every frame, a TileSprite is a single quad.
    const pad = 60;
    const tileKey = ensureParallaxStarTexture(this, 'map_deep_stars_tile', 720 + pad * 2, 2048, {
      count: 360,
      seed: 4096,
      colors: [COLOR_NUMBERS.amberSolid, 0x7fb8ff, 0xcfe6ff, 0xff8fc8, 0x5c7cfa, 0xffffff],
      minRadius: 0.7,
      maxRadius: 1.6,
      minAlpha: 0.4,
      maxAlpha: 0.95,
      coreChance: 0.35,
    });
    this.mapDeepStarsContainer = this.add.container(0, 0).setDepth(-2);
    this.mapDeepStarsContainer.add(
      this.add.tileSprite(-pad, -pad, 720 + pad * 2, totalHeight + pad * 2, tileKey).setOrigin(0)
    );
    this.mapContainer.add(this.mapDeepStarsContainer);
    this.backdropParts.push(this.mapDeepStarsContainer);

    // 2. Lớp giữa (Depth -1): Chứa bụi sao lấp lánh và sao băng
    this.mapMidStarsContainer = this.add.container(0, 0).setDepth(-1);
    this.mapContainer.add(this.mapMidStarsContainer);
    this.backdropParts.push(this.mapMidStarsContainer);
  }

  private addChapterAtmosphereFx(bands: readonly ChapterBand[]): void {
    const starKey = ensureWhiteStarTexture(this);
    for (const band of bands) {
      const gTheme = resolveGalaxyTheme(band.chapter);
      const sparkles = createSparkles(1701 + band.chapter * 83, Math.round((band.bottom - band.top) / 36), band.top + 100, band.bottom - 60, 6.5).map((data) => {
        const image = this.add.image(data.x, data.y, starKey)
          .setDisplaySize(data.size * 2.8, data.size * 2.8)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(data.size > 5 ? gTheme.colors.accent : 0xffffff);
        (this.mapMidStarsContainer ?? this.mapContainer).add(image);
        this.backdropParts.push(image);
        return { data, image };
      });
      let meteor: Phaser.GameObjects.Image | undefined;
      if (band.chapter <= 2) {
        meteor = this.add.image(0, 0, ensureMeteorTexture(this))
          .setOrigin(1, 0.5).setRotation(METEOR_HEADING).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        (this.mapMidStarsContainer ?? this.mapContainer).add(meteor);
      }
      this.chapterAtmosphereFx.push({
        chapter: band.chapter,
        band,
        sparkles,
        meteor,
        elapsedMs: 0,
      });
    }
  }

  private addChapterOneFx(band: { top: number; bottom: number }): void {
    const starKey = ensureWhiteStarTexture(this);
    const sparkles = createSparkles(1701, Math.round((band.bottom - band.top) / 30), band.top + 140, band.bottom - 60, 7).map((data) => {
      const image = this.add.image(data.x, data.y, starKey)
        .setDisplaySize(data.size * 3, data.size * 3)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.mapContainer.add(image);
      this.backdropParts.push(image);
      return { data, image };
    });
    const meteor = this.add.image(0, 0, ensureMeteorTexture(this))
      .setOrigin(1, 0.5).setRotation(METEOR_HEADING).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.mapContainer.add(meteor);
    this.chapterOneFx = { band, sparkles, meteor, elapsedMs: 0 };
    this.updateChapterOneFx(0);
  }

  private updateChapterAtmosphereFx(delta: number): void {
    const still = isReducedMotion();
    const viewHeight = designViewBounds(this).height;
    const screenTop = -this.mapContainer.y - 300;
    const screenBottom = -this.mapContainer.y + viewHeight + 300;

    for (const fx of this.chapterAtmosphereFx) {
      if (fx.band.bottom < screenTop || fx.band.top > screenBottom) continue;
      if (!still) fx.elapsedMs += Math.min(delta, 50);
      for (const { data, image } of fx.sparkles) {
        image.setAlpha(still ? 0.55 : sparkleAlpha(data, fx.elapsedMs));
      }
      if (fx.meteor) {
        const pose = still ? null : meteorPose(fx.elapsedMs);
        if (!pose) {
          fx.meteor.setVisible(false);
          fx.meteorOrigin = undefined;
          continue;
        }
        fx.meteorOrigin ??= {
          x: -60 + pose.rx * 480,
          y: Phaser.Math.Clamp(-this.mapContainer.y + 120 + pose.ry * 520, fx.band.top + 60, fx.band.bottom - 340),
        };
        fx.meteor
          .setPosition(fx.meteorOrigin.x + Math.cos(METEOR_HEADING) * METEOR_TRAVEL * pose.progress, fx.meteorOrigin.y + Math.sin(METEOR_HEADING) * METEOR_TRAVEL * pose.progress)
          .setAlpha(pose.alpha * 0.9)
          .setVisible(true);
      }
    }
  }

  private updateChapterOneFx(delta: number): void {
    const fx = this.chapterOneFx;
    if (!fx) return;
    const still = isReducedMotion();
    if (!still) fx.elapsedMs += Math.min(delta, 50);
    for (const { data, image } of fx.sparkles) image.setAlpha(still ? 0.55 : sparkleAlpha(data, fx.elapsedMs));
    const pose = still ? null : meteorPose(fx.elapsedMs);
    if (!pose) {
      fx.meteor.setVisible(false);
      fx.meteorOrigin = undefined;
      return;
    }
    // Aim the streak at whatever part of chapter 1 the player is looking at when it starts.
    fx.meteorOrigin ??= {
      x: -60 + pose.rx * 480,
      y: Phaser.Math.Clamp(-this.mapContainer.y + 120 + pose.ry * 520, fx.band.top + 60, fx.band.bottom - 340),
    };
    fx.meteor
      .setPosition(fx.meteorOrigin.x + Math.cos(METEOR_HEADING) * METEOR_TRAVEL * pose.progress, fx.meteorOrigin.y + Math.sin(METEOR_HEADING) * METEOR_TRAVEL * pose.progress)
      .setAlpha(pose.alpha * 0.9)
      .setVisible(true);
  }

  /** A soft ripple leaves the level the player should play next. */
  private addCurrentNodePulse(nodeContainer: Phaser.GameObjects.Container, color: number): void {
    if (isReducedMotion()) return;
    const ring = this.add.graphics();
    nodeContainer.addAt(ring, 0);
    const state = { radius: 34, alpha: 0.55 };
    this.tweens.add({
      targets: state,
      radius: 66,
      alpha: 0,
      duration: 1900,
      repeat: -1,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        if (!ring.active) return;
        ring.clear();
        ring.lineStyle(3, color, state.alpha);
        ring.strokeCircle(0, 0, state.radius);
      },
    });
  }

  private showToast(message: string): void {
    if (this.toastContainer) this.toastContainer.destroy();

    this.toastContainer = this.add.container(360, 1160).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(COLOR_NUMBERS.navyBackdrop, 0.95);
    bg.fillRoundedRect(-180, -26, 360, 52, 26);
    bg.lineStyle(1.5, COLOR_NUMBERS.amberSolid, 0.85);
    bg.strokeRoundedRect(-180, -26, 360, 52, 26);

    const toast = this.add
      .text(0, 0, message, {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '22px',
        color: COLOR_TOKENS.amberGold.solidPrimary,
      })
      .setOrigin(0.5);

    this.toastContainer.add([bg, toast]);

    this.tweens.add({
      targets: this.toastContainer,
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => {
        this.toastContainer?.destroy();
      },
    });
  }
}
