import Phaser from 'phaser';
import { TYPO_TOKENS } from '../designTokens.ts';
import { SPLIT_OFFSET, TITLE_TIMING, letterEntrance, titleStyle } from './chapterTitleMotion.ts';
import { isReducedMotion } from '../transitions/motion.ts';

export type ChapterTitleSpec = {
  chapter: number;
  roman: string;
  name: string;
  subtitle: string;
  accent: number;
  accentHex: string;
};

export type ChapterTitleCard = { container: Phaser.GameObjects.Container; play(): void };

const NUMERAL_Y = -64;
const SUBTITLE_Y = 54;
const NAME_SIZE = 46;
const MAX_NAME_WIDTH = 620;
const NAME_DELAY_MS = 500;
const LETTER_MS = 650;

/**
 * Centre-of-band title that plays once when a chapter scrolls into view: rules
 * open, the numeral lands, the name enters in the chapter's own style, then the
 * whole card fades and leaves the artwork to loop. Hidden until `play()`; under
 * reduced motion it never shows (the banner pill already names the chapter).
 */
export function createChapterTitleCard(scene: Phaser.Scene, x: number, y: number, spec: ChapterTitleSpec): ChapterTitleCard {
  const container = scene.add.container(x, y).setAlpha(0);
  const display = TYPO_TOKENS.fontFamily.display;
  // Padding keeps the blurred shadow inside the text canvas; without it the glow is cut into a dark box.
  const glow = (text: Phaser.GameObjects.Text, blur: number) => text.setPadding(blur * 1.5).setShadow(0, 0, spec.accentHex, blur, false, true);

  const numeral = glow(scene.add.text(0, NUMERAL_Y, spec.roman, { fontFamily: display, fontSize: '60px', color: spec.accentHex, fontStyle: 'bold' }).setOrigin(0.5), 28).setAlpha(0);
  const wingGap = numeral.width / 2 + 14;
  const wings = [-1, 1].map((side) => {
    const wing = scene.add.graphics({ x: side * wingGap, y: NUMERAL_Y });
    wing.fillStyle(spec.accent, 0.9);
    wing.fillRect(side > 0 ? 0 : -110, -1, 110, 2);
    wing.setScale(0, 1);
    return wing;
  });
  const subtitle = scene.add.text(0, SUBTITLE_Y, spec.subtitle.toUpperCase(), { fontFamily: TYPO_TOKENS.fontFamily.sans, fontSize: '16px', color: spec.accentHex, fontStyle: 'bold', stroke: '#120E36', strokeThickness: 4 })
    .setOrigin(0.5).setLetterSpacing(3).setAlpha(0);
  const nameGroup = scene.add.container(0, 0);
  container.add([...wings, numeral, nameGroup, subtitle]);

  const style = titleStyle(spec.chapter);
  const nameStyle = { fontFamily: display, fontSize: `${NAME_SIZE}px`, color: '#ffffff', fontStyle: 'bold' };
  const starters: Array<() => void> = [];
  const later = (config: Phaser.Types.Tweens.TweenBuilderConfig) => starters.push(() => scene.tweens.add(config));

  if (style === 'split') {
    // Cyan and magenta copies slide together over a white one, like light leaving a prism.
    const layers: Array<{ color: string; offset: number; peak: number }> = [
      { color: '#ff2fb8', offset: SPLIT_OFFSET, peak: 0.9 },
      { color: '#00e5ff', offset: -SPLIT_OFFSET, peak: 0.9 },
      { color: '#ffffff', offset: 0, peak: 1 },
    ];
    for (const layer of layers) {
      const copy = scene.add.text(layer.offset, 0, spec.name, { ...nameStyle, color: layer.color }).setOrigin(0.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      nameGroup.add(copy);
      later({ targets: copy, x: 0, alpha: layer.peak, delay: NAME_DELAY_MS + (layer.offset === 0 ? 150 : 0), duration: 900, ease: 'Cubic.easeOut' });
    }
  } else {
    const glyphs = Array.from(spec.name.normalize('NFC'));
    const probe = scene.add.text(0, 0, '', nameStyle);
    const widths = glyphs.map((glyph) => (glyph === ' ' ? NAME_SIZE * 0.3 : probe.setText(glyph).width));
    probe.destroy();
    const total = widths.reduce((sum, w) => sum + w, 0);
    let cursor = -total / 2;
    glyphs.forEach((glyph, i) => {
      const centreX = cursor + widths[i] / 2;
      cursor += widths[i];
      if (glyph === ' ') return;
      const entrance = letterEntrance(style, i, glyphs.length);
      const pivot = scene.add.container(centreX + entrance.fromX, entrance.pivotY + entrance.fromY).setAlpha(0).setAngle(entrance.fromAngle).setScale(entrance.fromScaleX, 1);
      pivot.add(glow(scene.add.text(0, -entrance.pivotY, glyph, nameStyle).setOrigin(0.5), 14));
      nameGroup.add(pivot);
      later({ targets: pivot, x: centreX, y: entrance.pivotY, angle: 0, scaleX: 1, alpha: 1, delay: NAME_DELAY_MS + entrance.delayMs, duration: LETTER_MS, ease: 'Cubic.easeOut' });
    });
    if (total > MAX_NAME_WIDTH) nameGroup.setScale(MAX_NAME_WIDTH / total);
  }

  const settleAt = NAME_DELAY_MS + TITLE_TIMING.enterMs + LETTER_MS;
  return {
    container,
    play() {
      if (isReducedMotion()) return;
      container.setAlpha(1);
      scene.tweens.add({ targets: numeral, alpha: 1, scale: { from: 1.6, to: 1 }, delay: 200, duration: 550, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: wings, scaleX: 1, duration: 600, ease: 'Cubic.easeOut' });
      scene.tweens.add({ targets: subtitle, alpha: 0.95, delay: NAME_DELAY_MS + 800, duration: 600 });
      starters.forEach((start) => start());
      scene.tweens.add({
        targets: container, alpha: 0, delay: settleAt + TITLE_TIMING.holdMs, duration: TITLE_TIMING.exitMs, ease: 'Sine.easeIn',
        onComplete: () => container.setVisible(false),
      });
    },
  };
}
