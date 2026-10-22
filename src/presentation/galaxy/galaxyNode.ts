import Phaser from 'phaser';
import { isReducedMotion } from '../transitions/motion.ts';

/**
 * Level-node art for the galaxy map, ported from the GalaxyKit "ba trạng thái
 * nút màn" reference (docs/gdd/assets/Bộ nhận diện năm thiên hà-html). The
 * mockup is 390 px wide and the game canvas 720 px, hence the 720/390 factor.
 */
export type GalaxyNodeState = 'completed' | 'current' | 'locked';

/** Mockup (390 px) to canvas factor for map nodes; a little under 720/390 so nodes breathe. */
export const NODE_SCALE = 1.5;
const K = NODE_SCALE;
/** Half diagonal of the diamond: 26 mockup px. */
export const NODE_HALF = 26 * K;
/** Distance from the node centre to its id caption (mockup: 42 px). */
export const NODE_LABEL_Y = 42 * K;

const GOLD = 0xffc857;
const CREAM = 0xfff6da;
const INK = 0x1a1446;
const LOCK_FILL = 0x17143f;
const LOCK_ICON = 0xb9b6e8;

function diamond(half: number): Phaser.Geom.Point[] {
  return [
    new Phaser.Geom.Point(0, -half),
    new Phaser.Geom.Point(half, 0),
    new Phaser.Geom.Point(0, half),
    new Phaser.Geom.Point(-half, 0),
  ];
}

/** Soft halo: stacked translucent diamonds stand in for the mockup's Gaussian blur. */
function glow(g: Phaser.GameObjects.Graphics, color: number, strength: number): void {
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(color, strength * (0.2 - i * 0.035));
    g.fillPoints(diamond(NODE_HALF + i * 5), true);
  }
}

function drawPadlock(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(LOCK_ICON, 1);
  g.fillRoundedRect(-6 * K, -1 * K, 12 * K, 9 * K, 2 * K);
  g.lineStyle(2 * K, LOCK_ICON, 1);
  g.beginPath();
  g.moveTo(-3.5 * K, -1 * K);
  g.lineTo(-3.5 * K, -4 * K);
  g.arc(0, -4 * K, 3.5 * K, Math.PI, Math.PI * 2, false);
  g.lineTo(3.5 * K, -1 * K);
  g.strokePath();
}

function startPulse(scene: Phaser.Scene, ring: Phaser.GameObjects.Graphics, delay: number): void {
  ring.setScale(0.7);
  scene.tweens.add({
    targets: ring,
    scale: 1.8,
    alpha: { from: 1, to: 0 },
    duration: 1800,
    delay,
    repeat: -1,
    ease: 'Sine.easeOut',
  });
}

/**
 * Builds the diamond body for one state and returns the layers to add, bottom
 * first. `completed` leaves the centre free for the player's silhouette.
 */
export function createGalaxyNodeBody(
  scene: Phaser.Scene,
  state: GalaxyNodeState,
  accent: number
): Phaser.GameObjects.GameObject[] {
  const layers: Phaser.GameObjects.GameObject[] = [];
  const body = scene.add.graphics();

  if (state === 'locked') {
    body.fillStyle(LOCK_FILL, 0.85);
    body.fillPoints(diamond(NODE_HALF), true);
    body.lineStyle(2.5 * K, accent, 0.55);
    body.strokePoints(diamond(NODE_HALF), true);
    drawPadlock(body);
    layers.push(body);
    return layers;
  }

  if (state === 'completed') {
    glow(body, accent, 1);
    body.fillStyle(GOLD, 1);
    body.fillPoints(diamond(NODE_HALF), true);
    body.lineStyle(3.5 * K, accent, 1);
    body.strokePoints(diamond(NODE_HALF), true);
    body.fillStyle(0xffffff, 0.28);
    body.fillTriangle(0, -22 * K, 18 * K, -4 * K, -18 * K, -4 * K);
    layers.push(body);
    return layers;
  }

  // Current: two staggered pulse rings behind a cream, white-rimmed diamond.
  for (const [color, width, delay] of [[accent, 2.5, 0], [0xffffff, 2, 900]] as const) {
    const ring = scene.add.graphics();
    ring.lineStyle(width * K, color, 1);
    ring.strokeCircle(0, 0, 34 * K);
    layers.push(ring);
    if (!isReducedMotion()) startPulse(scene, ring, delay);
    else ring.setAlpha(0.5).setScale(1.1);
  }
  glow(body, accent, 1.6);
  body.fillStyle(CREAM, 1);
  body.fillPoints(diamond(NODE_HALF), true);
  body.lineStyle(4 * K, 0xffffff, 1);
  body.strokePoints(diamond(NODE_HALF), true);
  body.fillStyle(INK, 1);
  body.fillTriangle(-6 * K, -9 * K, 9 * K, 0, -6 * K, 9 * K);
  layers.push(body);
  return layers;
}
