import Phaser from 'phaser';
import { COLOR_NUMBERS, COLOR_TOKENS, DEPTH_TOKENS, LAYOUT_TOKENS } from '../designTokens.ts';
import { generateStarField, twinkleAlpha, driftOffset } from './starField.ts';
import { designViewBounds } from '../designViewport.ts';
import type { DesignView } from '../viewport.ts';
import type { Star } from './starField.ts';
import { advanceDrift } from './skyMood.ts';
import type { MoodState } from './skyMood.ts';
import { milkyWayBlobs, MILKY_WAY_SEED } from '../galaxy/milkyWay.ts';

/**
 * Quầng sáng tròn mờ dần ra mép, dùng gradient thật của canvas 2D.
 * Chuyển từ màu đầy đủ ở tâm về trong suốt ở bán kính `radius`.
 */
export function radialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hex: string,
  peakAlpha: number
): void {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${peakAlpha})`);
  glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

export type SkyBackdropOptions = {
  seed: number;
  /** 0 đứng yên, 1 trôi đủ tốc độ; BackgroundScene tween giá trị này */
  driftSpeed: number;
};

/**
 * Nền trời dùng chung cho mọi màn: gradient bốn chặng, dải Ngân Hà nhiều lớp (Milky Way),
 * hai nebula, quầng trăng, và trường sao.
 *
 * Chia làm ba lớp vì chúng có nhịp khác nhau:
 *  - Lớp trời (gradient, nebula, trăng) không bao giờ đổi -> RenderTexture.
 *  - Lớp sao tĩnh đổi vị trí cả khối khi trôi -> TileSprite, cuộn bằng
 *    tilePositionY nên không phải vẽ lại 120 sao mỗi khung hình.
 *  - Lớp sao nhấp nháy đổi độ sáng từng sao -> Graphics, chỉ 30 sao.
 *
 * Gộp lớp sao vào lớp trời là sai: lúc đó sao không thể trôi, và vì chúng
 * chiếm đa số nên mắt đọc ra nền hoàn toàn tĩnh.
 */
export class SkyBackdrop {
  private readonly scene: Phaser.Scene;
  public readonly moodState: MoodState;
  private readonly dimLayer: Phaser.GameObjects.Rectangle;
  private readonly skyLayer: Phaser.GameObjects.RenderTexture;
  private readonly starLayer: Phaser.GameObjects.TileSprite;
  private readonly twinkleLayer: Phaser.GameObjects.Graphics;
  private readonly twinklingStars: Star[];
  private readonly staticStars: Star[];
  private readonly starTextureKey: string;
  private elapsedMs = 0;
  private driftMs = 0;

  constructor(scene: Phaser.Scene, options: SkyBackdropOptions) {
    this.scene = scene;

    const { width, height } = LAYOUT_TOKENS.canvas;
    const field = generateStarField(options.seed, { width, height });
    this.staticStars = field.static;
    this.twinklingStars = field.twinkling;
    this.starTextureKey = `sky_stars_${options.seed}`;

    const view = designViewBounds(scene);

    this.skyLayer = scene.add
      .renderTexture(view.x, view.y, view.width, view.height)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.backgroundSky);

    this.paintSky(view);
    this.buildStarTexture(width, height);

    this.starLayer = scene.add
      // TileSprite lặp texture sao nên tự phủ kín phần cao thêm, không cần sinh
      // thêm sao.
      .tileSprite(view.x, view.y, view.width, view.height, this.starTextureKey)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.backgroundSky + 1);

    this.twinkleLayer = scene.add.graphics().setDepth(DEPTH_TOKENS.backgroundSky + 2);

    this.moodState = { driftSpeed: options.driftSpeed, dim: 0 };
    // Lớp tối phủ cả trời và sao: mood `play` làm nền lùi lại sau tấm bia
    this.dimLayer = scene.add
      // Cover the real view, not the 720x1280 base: tall phones showed an edge at y=1280.
      .rectangle(view.x, view.y, view.width, view.height, COLOR_NUMBERS.navyBackdrop, 1)
      .setOrigin(0, 0)
      .setAlpha(0)
      .setDepth(DEPTH_TOKENS.backgroundSky + 3);
  }

  /**
   * Gradient trời, hai nebula và quầng trăng — phần không bao giờ đổi.
   *
   * Dựng bằng canvas 2D vì nó có gradient thật. Trước đây xấp xỉ bằng các dải
   * ngang và vòng tròn đồng tâm, và mắt thấy rõ từng vòng (banding).
   *
   * Vẽ ở đúng chiều cao nhìn thấy, không vẽ khung 1280 rồi nối thêm hai dải.
   * Cách nối từng bị loại vì mép khung không phải màu stop thuần — nebula hồng
   * tâm (648, 966) bán kính 360 phủ tới y=1326, tức là tràn qua mép dưới — nên
   * dải nối luôn lệch tông và để lộ một đường ranh. Gradient của canvas tự kẹp
   * màu ngoài hai đầu, còn nebula vẽ ở cùng toạ độ thiết kế thì tràn ra tự
   * nhiên: không còn ranh giới nào để lệch.
   */
  private paintSky(view: DesignView): void {
    const { width, height } = LAYOUT_TOKENS.canvas;
    const viewHeight = Math.ceil(view.height);
    const key = `sky_milky_${width}x${viewHeight}`;
    const tm = this.scene.textures;

    // Khung 1280 được căn giữa chiều cao thật, nên nền giữ nguyên bố cục gốc
    // dù màn dài tới đâu.
    const frameTop = (view.height - height) / 2;

    if (!tm.exists(key)) {
      const canvas = tm.createCanvas(key, width, viewHeight);
      if (canvas) {
        const ctx = canvas.context;

        const sky = ctx.createLinearGradient(0, frameTop, 0, frameTop + height);
        COLOR_TOKENS.sky.stops.forEach((stop, i) => {
          sky.addColorStop(COLOR_TOKENS.sky.stopOffsets[i], stop);
        });
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, viewHeight);

        for (const blob of milkyWayBlobs(MILKY_WAY_SEED, width, height)) {
          radialGlow(ctx, blob.x, frameTop + blob.y, blob.r, blob.hex, blob.alpha);
        }

        // Toạ độ theo mockup 390x844, quy đổi sang canvas 720x1280
        radialGlow(ctx, 108, frameTop + 436, 396, COLOR_TOKENS.sky.nebulaBlue, 0.45);
        radialGlow(ctx, 648, frameTop + 966, 360, COLOR_TOKENS.sky.nebulaPink, 0.32);
        radialGlow(ctx, 619, frameTop + 140, 158, COLOR_TOKENS.sky.moonHalo, 0.35);
        radialGlow(ctx, 619, frameTop + 140, 62, COLOR_TOKENS.sky.moonCore, 0.9);

        canvas.refresh();
      }
    }

    this.skyLayer.draw(key, 0, 0);
  }

  /**
   * Nướng 120 sao tĩnh thành một texture để TileSprite cuộn được cả khối.
   * Texture lặp theo chiều dọc nên sao phải phủ đều, không chừa dải trống.
   */
  private buildStarTexture(width: number, height: number): void {
    if (this.scene.textures.exists(this.starTextureKey)) return;

    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (const star of this.staticStars) {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(star.color).color, star.alpha);
      g.fillCircle(star.x, star.y, star.r);
    }
    g.generateTexture(this.starTextureKey, width, height);
    g.destroy();
  }


  public update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.driftMs = advanceDrift(this.driftMs, deltaMs, this.moodState.driftSpeed);
    const { height } = LAYOUT_TOKENS.canvas;
    const offset = driftOffset(this.driftMs, height);

    // tilePositionY âm dần thì texture đi xuống, tức sao rơi xuống.
    this.starLayer.tilePositionY = -offset;

    this.twinkleLayer.clear();
    for (const star of this.twinklingStars) {
      const y = (star.y + offset) % height;
      const alpha = twinkleAlpha(star, this.elapsedMs);
      this.twinkleLayer.fillStyle(
        Phaser.Display.Color.HexStringToColor(star.color).color,
        alpha
      );
      this.twinkleLayer.fillCircle(star.x, y, star.r);
    }

    this.dimLayer.setAlpha(this.moodState.dim);
  }

  public destroy(): void {
    this.dimLayer.destroy();
    this.skyLayer.destroy();
    this.starLayer.destroy();
    this.twinkleLayer.destroy();
    if (this.scene.textures.exists(this.starTextureKey)) {
      this.scene.textures.remove(this.starTextureKey);
    }
  }
}
