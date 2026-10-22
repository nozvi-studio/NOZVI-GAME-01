import Phaser from 'phaser';
import type { Level } from '../../domain/model.ts';
import type { LayoutMetrics } from './layout.ts';
import { COLOR_NUMBERS, DEPTH_TOKENS, FEEDBACK_TOKENS, LAYOUT_TOKENS } from '../designTokens.ts';
import { BADGE_SILHOUETTE_FIT, drawTargetSilhouette } from './targetSilhouette.ts';
import { motionFamily, scaleTiming } from '../transitions/motion.ts';

export class TargetBadge {
  private scrim: Phaser.GameObjects.Rectangle;
  private container: Phaser.GameObjects.Container;
  private badgeGraphics: Phaser.GameObjects.Graphics;
  private targetGraphics: Phaser.GameObjects.Graphics;
  private isEnlarged = false;
  private readonly baseScale: number;

  constructor(scene: Phaser.Scene, layout: LayoutMetrics, level: Level) {
    this.baseScale = layout.targetBadgeScale;
    // Quiets the field behind the enlarged medallion so the silhouette is read
    // against calm, not against the board.
    this.scrim = scene.add
      .rectangle(0, 0, LAYOUT_TOKENS.canvas.width, layout.designHeight, COLOR_NUMBERS.navyBackdrop, 1)
      .setOrigin(0, 0)
      .setDepth(DEPTH_TOKENS.hudControls + 4)
      .setAlpha(0);

    // Tâm huy hiệu: chồng một phần lên mép trên bàn như mockup, nhưng đỉnh huy
    // hiệu phải nằm dưới phụ đề chương — trước đây đè lên nó. Bám theo bàn chứ
    // không viết cứng, vì bàn trôi theo chiều cao màn thật.
    const cx = 360;
    const cy = layout.targetBadgeY;

    this.container = scene.add.container(cx, cy).setDepth(DEPTH_TOKENS.hudControls + 5).setScale(this.baseScale);
    this.badgeGraphics = scene.add.graphics();
    this.targetGraphics = scene.add.graphics();
    this.container.add([this.badgeGraphics, this.targetGraphics]);

    this.drawBadgeBase();
    drawTargetSilhouette(this.targetGraphics, level, BADGE_SILHOUETTE_FIT, {
      filled: COLOR_NUMBERS.amberSolid,
      hollow: COLOR_NUMBERS.boardSurfaceTop,
    });

    // Vùng chạm hình tròn mở rộng bán kính 96px (đạt chuẩn touch target)
    this.container.setSize(192, 192);
    this.container.setInteractive(
      new Phaser.Geom.Circle(0, 0, 96),
      Phaser.Geom.Circle.Contains
    );

    // Chạm vào phóng to tạm thời (1.35x) để soi rõ mục tiêu
    this.container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.animateZoom(scene);
    });
  }

  private drawBadgeBase(): void {
    const g = this.badgeGraphics;
    g.clear();

    const r = 76;

    // 1. Quầng sáng mềm bên ngoài
    g.lineStyle(4, COLOR_NUMBERS.icePrimary, 0.2);
    g.strokeCircle(0, 0, r + 2);

    // 2. Lòng huy hiệu xanh như mặt bàn, sáng dần lên phía trên-trái — mockup
    // dùng kính xanh, không phải hố đen.
    g.fillStyle(COLOR_NUMBERS.buttonFillBottom, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(COLOR_NUMBERS.buttonFillTop, 0.55);
    g.fillCircle(-r * 0.15, -r * 0.2, r * 0.72);
    g.fillStyle(COLOR_NUMBERS.boardSurfaceTop, 0.5);
    g.fillCircle(0, 0, r * 0.86);

    // 3. Viền kính xanh 6px có bevel
    g.lineStyle(6, COLOR_NUMBERS.icePrimary, 0.95);
    g.strokeCircle(0, 0, r - 3);

    // Highlight cạnh trên
    g.lineStyle(2.5, COLOR_NUMBERS.iceHighlight, 0.9);
    g.beginPath();
    g.arc(0, 0, r - 3, Math.PI * 1.1, Math.PI * 1.9);
    g.strokePath();

    // Rãnh bóng tối cạnh dưới
    g.lineStyle(2.5, COLOR_NUMBERS.iceShadow, 0.85);
    g.beginPath();
    g.arc(0, 0, r - 3, Math.PI * 0.1, Math.PI * 0.9);
    g.strokePath();

    // 4. Vòng vàng đứt nét bên trong (bán kính 75px)
    const ringR = 63;
    g.lineStyle(1.5, COLOR_NUMBERS.gridModule, 0.55);
    const numDashes = 28;
    for (let i = 0; i < numDashes; i++) {
      const startA = (i / numDashes) * Math.PI * 2;
      const endA = startA + (Math.PI * 2) / (numDashes * 2);
      g.beginPath();
      g.arc(0, 0, ringR, startA, endA);
      g.strokePath();
    }

    // 5. 4 vạch rune nhỏ ở 4 hướng chính (0°, 90°, 180°, 270°)
    g.fillStyle(COLOR_NUMBERS.amberSolid, 0.9);
    // Bắc
    this.drawMiniDiamond(g, 0, -ringR, 3, 5);
    // Nam
    this.drawMiniDiamond(g, 0, ringR, 3, 5);
    // Đông
    this.drawMiniDiamond(g, ringR, 0, 5, 3);
    // Tây
    this.drawMiniDiamond(g, -ringR, 0, 5, 3);
  }

  private drawMiniDiamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    rx: number,
    ry: number
  ): void {
    const pts = [
      new Phaser.Geom.Point(x, y - ry),
      new Phaser.Geom.Point(x + rx, y),
      new Phaser.Geom.Point(x, y + ry),
      new Phaser.Geom.Point(x - rx, y),
    ];
    g.fillPoints(pts, true);
  }



  private animateZoom(scene: Phaser.Scene): void {
    if (this.isEnlarged) return;
    this.isEnlarged = true;
    const glass = motionFamily('glass');
    const ms = scaleTiming(glass.durationMs);

    scene.tweens.add({
      targets: this.scrim,
      alpha: FEEDBACK_TOKENS.medallionScrimAlpha,
      duration: ms,
      ease: 'Quart.easeOut',
    });
    scene.tweens.add({
      targets: this.container,
      scaleX: this.baseScale * 1.35,
      scaleY: this.baseScale * 1.35,
      duration: ms,
      ease: 'Quart.easeOut',
      onComplete: () => {
        scene.time.delayedCall(900, () => {
          scene.tweens.add({
            targets: this.scrim,
            alpha: 0,
            duration: ms,
            ease: 'Quart.easeOut',
          });
          scene.tweens.add({
            targets: this.container,
            scaleX: this.baseScale,
            scaleY: this.baseScale,
            duration: ms,
            ease: 'Quart.easeOut',
            onComplete: () => {
              this.isEnlarged = false;
            },
          });
        });
      },
    });
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public destroy(): void {
    this.scrim.destroy();
    this.container.destroy();
  }
}
