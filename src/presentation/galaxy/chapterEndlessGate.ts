import Phaser from 'phaser';
import type { GalaxyTheme } from './galaxyTheme.ts';
import { TYPO_TOKENS } from '../designTokens.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { t } from '../i18n.ts';

export interface ChapterEndlessGateConfig {
  x: number;
  y: number;
  theme: GalaxyTheme;
  title?: string;
  badgeText?: string;
  isUnlocked?: boolean;
  onPointerUp?: () => void;
}

/**
 * ChapterEndlessGate: Cổng vũ trụ Ải Vô Tận ở cuối mỗi chặng chương
 * Chuẩn mockup: GalaxyMap.dc.html
 * - 2 vòng tròn đứt nét quay ngược chiều nhau (portalA, portalB)
 * - Quầng sáng thở phồng xẹp (breath)
 * - Nhãn viên thuốc kính "Ải Vô Tận · Sắp mở"
 */
export class ChapterEndlessGate extends Phaser.GameObjects.Container {
  private portalOuterGlow: Phaser.GameObjects.Graphics;
  private ringA: Phaser.GameObjects.Graphics;
  private ringB: Phaser.GameObjects.Graphics;
  private coreIcon: Phaser.GameObjects.Graphics;
  private labelText?: Phaser.GameObjects.Text;
  private badgeContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, config: ChapterEndlessGateConfig) {
    super(scene, config.x, config.y);

    const accentColor = config.theme.colors.accent;
    const open = config.isUnlocked ?? false;
    const still = isReducedMotion();

    // 1. Quầng sáng thở (Breathing outer glow)
    this.portalOuterGlow = scene.add.graphics();
    this.portalOuterGlow.fillStyle(accentColor, 0.35);
    this.portalOuterGlow.fillCircle(0, 0, 40);
    this.add(this.portalOuterGlow);

    // Hiệu ứng thở (breath): chỉ khi cổng đã mở; cổng ngủ có nhịp riêng bên dưới
    if (open && !isReducedMotion()) scene.tweens.add({
      targets: this.portalOuterGlow,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: 0.5,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 2. Lõi tối trung tâm
    const coreDark = scene.add.graphics();
    coreDark.fillStyle(0x120e36, 0.85);
    coreDark.fillCircle(0, 0, 33);
    this.add(coreDark);

    // Sleeping gate: dim, slow and flickering. Open gate: bright, quick, rippling, with sparks in orbit.
    if (!open) {
      this.portalOuterGlow.setAlpha(0.2);
      if (!still) {
        scene.tweens.add({ targets: this.portalOuterGlow, alpha: { from: 0.12, to: 0.3 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else if (!still) {
      // Two shockwaves leave the gate in turn.
      for (const delay of [0, 1200]) {
        const wave = scene.add.graphics();
        wave.lineStyle(2.5, accentColor, 0.8);
        wave.strokeCircle(0, 0, 34);
        wave.setAlpha(0);
        this.add(wave);
        scene.tweens.add({ targets: wave, scale: { from: 1, to: 2.2 }, alpha: { from: 0.7, to: 0 }, duration: 2400, delay, repeat: -1, ease: 'Sine.easeOut' });
      }
      // Four sparks circle the gate.
      for (let i = 0; i < 4; i++) {
        const pivot = scene.add.container(0, 0).setAngle(i * 90);
        const spark = scene.add.graphics();
        spark.fillStyle(0xffffff, 0.95);
        spark.fillCircle(46, 0, 2.4);
        spark.fillStyle(accentColor, 0.5);
        spark.fillCircle(46, 0, 5);
        pivot.add(spark);
        this.add(pivot);
        scene.tweens.add({ targets: pivot, angle: i * 90 + 360, duration: 5200, repeat: -1, ease: 'Linear' });
      }
    }

    // 3. Vòng tròn đứt A (portalA: bán kính 33, xoay cùng chiều kim đồng hồ)
    this.ringA = scene.add.graphics();
    this.ringA.lineStyle(3, accentColor, 0.95);
    // Vẽ nét đứt theo cung tròn
    const segmentsA = 10;
    for (let i = 0; i < segmentsA; i++) {
      const startAngle = (i / segmentsA) * Math.PI * 2;
      const endAngle = startAngle + (Math.PI * 2) / (segmentsA * 1.8);
      this.ringA.beginPath();
      this.ringA.arc(0, 0, 33, startAngle, endAngle);
      this.ringA.strokePath();
    }
    this.add(this.ringA);

    if (!open) this.ringA.setAlpha(0.45);
    if (!isReducedMotion()) scene.tweens.add({
      targets: this.ringA,
      angle: 360,
      duration: open ? 7000 : 24000,
      repeat: -1,
      ease: 'Linear',
    });

    // 4. Vòng tròn đứt B (portalB: bán kính 25, xoay ngược chiều)
    this.ringB = scene.add.graphics();
    this.ringB.lineStyle(1.8, 0xffffff, 0.7);
    const segmentsB = 8;
    for (let i = 0; i < segmentsB; i++) {
      const startAngle = (i / segmentsB) * Math.PI * 2;
      const endAngle = startAngle + (Math.PI * 2) / (segmentsB * 2.2);
      this.ringB.beginPath();
      this.ringB.arc(0, 0, 25, startAngle, endAngle);
      this.ringB.strokePath();
    }
    this.add(this.ringB);

    if (!isReducedMotion()) scene.tweens.add({
      targets: this.ringB,
      angle: -360,
      duration: 18000,
      repeat: -1,
      ease: 'Linear',
    });

    // 5. Biểu tượng vô cực / lốc xoáy trung tâm (Infinity sign)
    this.coreIcon = scene.add.graphics();
    this.coreIcon.lineStyle(3.2, 0xffffff, 1.0);
    // Lemniscate của mockup: M-12,0 C-12,-8 -2,-8 0,0 C2,8 12,8 12,0 C12,-8 2,-8 0,0 C-2,8 -12,8 -12,0
    const loop = (pts: ReadonlyArray<readonly [number, number]>): Phaser.Math.Vector2[] =>
      new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(pts[0][0], pts[0][1]),
        new Phaser.Math.Vector2(pts[1][0], pts[1][1]),
        new Phaser.Math.Vector2(pts[2][0], pts[2][1]),
        new Phaser.Math.Vector2(pts[3][0], pts[3][1])
      ).getPoints(14);
    const outline = [
      ...loop([[-12, 0], [-12, -8], [-2, -8], [0, 0]]),
      ...loop([[0, 0], [2, 8], [12, 8], [12, 0]]),
      ...loop([[12, 0], [12, -8], [2, -8], [0, 0]]),
      ...loop([[0, 0], [-2, 8], [-12, 8], [-12, 0]]),
    ];
    this.coreIcon.strokePoints(outline, true);
    this.add(this.coreIcon);
    if (!open) {
      this.coreIcon.setAlpha(0.5);
      if (!still) scene.tweens.add({ targets: this.coreIcon, alpha: { from: 0.35, to: 0.65 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!still) {
      scene.tweens.add({ targets: this.coreIcon, scale: { from: 1, to: 1.16 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // 6. Tiêu đề (nếu truyền vào)
    if (config.title) {
      this.labelText = scene.add
        .text(0, 52, config.title, {
          fontFamily: TYPO_TOKENS.fontFamily.display,
          fontSize: '14px',
          color: '#FFFFFF',
          fontStyle: 'bold',
          stroke: '#120E36',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      this.add(this.labelText);
    }

    // 7. Nhãn viên thuốc (mặc định "Sắp mở", y = 52 khi không có tiêu đề, y = 70 khi có)
    const badgeY = config.title ? 70 : 52;
    this.badgeContainer = scene.add.container(0, badgeY);
    const tagText = scene.add
      .text(0, 0, config.badgeText ?? t('gate_coming_soon'), {
        fontFamily: TYPO_TOKENS.fontFamily.sans,
        fontSize: '10px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const badgeW = Math.max(56, Math.round(tagText.width + 16));
    const tagBg = scene.add.graphics();
    tagBg.fillStyle(accentColor, config.isUnlocked ? 0.45 : 0.25);
    tagBg.fillRoundedRect(-badgeW / 2, -9, badgeW, 18, 9);
    tagBg.lineStyle(1.2, accentColor, 0.95);
    tagBg.strokeRoundedRect(-badgeW / 2, -9, badgeW, 18, 9);

    this.badgeContainer.add([tagBg, tagText]);
    this.add(this.badgeContainer);

    // 8. Tương tác nhấn mở màn chơi
    if (config.onPointerUp) {
      const hitZoneY = config.title ? 20 : 12;
      const hitZoneH = config.title ? 110 : 92;
      const hitZone = scene.add
        .zone(0, hitZoneY, 84, hitZoneH)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: config.isUnlocked ?? false });
      this.add(hitZone);

      hitZone.on('pointerup', () => {
        config.onPointerUp?.();
      });

      if (config.isUnlocked) {
        hitZone.on('pointerover', () => {
          this.portalOuterGlow.setAlpha(0.8);
        });
        hitZone.on('pointerout', () => {
          this.portalOuterGlow.setAlpha(0.35);
        });
      }
    }

    scene.add.existing(this);
  }
}
