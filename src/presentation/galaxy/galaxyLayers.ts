import Phaser from 'phaser';
import { isReducedMotion } from '../transitions/motion.ts';
import { meteorPose, orbitDotPose, type OrbitSpec } from './galaxyMotion.ts';

export type GalaxyLayerHost = {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  /** Display size of the 350-unit kit artboard. */
  size: number;
  /** Looping tweens: paused together when motion is off or the art is hidden. */
  motion: Phaser.Tweens.Tween[];
  /** Per-frame animators fed with the accumulated running time. */
  frame: Array<(elapsedMs: number) => void>;
  /** Target semi-axes (design units) of the ring ellipse once it stands up; omitted = the kit's own proportions. */
  ring?: { rx: number; ry: number };
  /** Intro tweens are created paused and parked here until the art scrolls into view. */
  heldIntro?: Phaser.Tweens.Tween[];
  /** Layers keep their final state, as under reduced motion (the map's later visits). */
  skipIntro?: boolean;
};

const kit = (host: GalaxyLayerHost) => host.size / 350;

/** A full-artboard layer; `anchor` (kit units) moves the origin so scale tweens grow from that point. */
function layer(host: GalaxyLayerHost, parent: Phaser.GameObjects.Container, stem: string, anchor?: { x: number; y: number }): Phaser.GameObjects.Image | null {
  const key = `galaxy-${stem}`;
  if (!host.scene.textures.exists(key)) return null;
  const image = host.scene.add.image(0, 0, key).setName(stem).setDisplaySize(host.size, host.size);
  if (anchor) {
    image.setOrigin(anchor.x / 350, anchor.y / 350);
    image.setPosition((anchor.x - 175) * kit(host), (anchor.y - 175) * kit(host));
  }
  parent.add(image);
  return image;
}

/** Under reduced motion layers keep their final state (never left at alpha 0); otherwise run the intro. */
function intro(host: GalaxyLayerHost, play: () => void): void {
  if (!isReducedMotion() && !host.skipIntro) play();
}

/** An intro tween; held (paused) when the host defers intros until the art is on screen. */
function introTween(host: GalaxyLayerHost, config: Phaser.Types.Tweens.TweenBuilderConfig): void {
  const tween = host.scene.tweens.add(host.heldIntro ? { ...config, paused: true } : config);
  host.heldIntro?.push(tween);
}

function fadeIn(host: GalaxyLayerHost, image: Phaser.GameObjects.Image | null, delay: number, duration = 700): void {
  if (!image) return;
  intro(host, () => {
    image.setAlpha(0);
    introTween(host, { targets: image, alpha: 1, delay, duration, ease: 'Sine.easeOut' });
  });
}

/** Kit `breath`: scale 1→1.12 and opacity .85→1 over a 3.2 s round trip. */
function breathe(host: GalaxyLayerHost, image: Phaser.GameObjects.Image | null): void {
  if (!image) return;
  const base = image.scaleX;
  image.setAlpha(0.85);
  host.motion.push(host.scene.tweens.add({
    targets: image, scaleX: base * 1.12, scaleY: base * 1.12, alpha: 1,
    duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  }));
}

function glowTexture(scene: Phaser.Scene): string {
  const key = 'galaxy-orbit-glow';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 32, 32)!;
  const glow = texture.context.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  texture.context.fillStyle = glow;
  texture.context.fillRect(0, 0, 32, 32);
  texture.refresh();
  return key;
}

function buildRing(host: GalaxyLayerHost): void {
  // The kit draws the ring horizontally; Menu3 and the map draw it standing up.
  const group = host.scene.add.container(0, 0).setAngle(90);
  // The kit ring is rx 115 / ry 75. Stretching the group in its own axes (before the 90 degree turn)
  // lets each screen use the proportions its mockup draws.
  if (host.ring) group.setScale(host.ring.ry / (115 * kit(host)), host.ring.rx / (75 * kit(host)));
  host.root.add(group);
  const body = layer(host, group, 'ring');
  // The ring turns into place and fades in; its core and orbiting dots keep looping underneath.
  if (body) {
    const bodyScale = body.scaleX;
    intro(host, () => {
      body.setAlpha(0).setScale(bodyScale * 0.8).setAngle(-50);
      introTween(host, { targets: body, alpha: 1, scaleX: bodyScale, scaleY: bodyScale, angle: 0, duration: 1800, ease: 'Cubic.easeOut' });
    });
  }
  breathe(host, layer(host, group, 'ring-core'));
  const streaks: Array<{ spec: OrbitSpec; tint: number; width: number }> = [
    { spec: { rx: 115, ry: 75, fraction: 0.07, phaseMs: 0, dots: 16 }, tint: 0xffffff, width: 7 },
    { spec: { rx: 115, ry: 75, fraction: 0.03, phaseMs: 3000, dots: 9 }, tint: 0x9fd8ff, width: 6 },
  ];
  const glow = glowTexture(host.scene);
  for (const { spec, tint, width } of streaks) {
    const dots = Array.from({ length: spec.dots }, () => {
      const dot = host.scene.add.image(0, 0, glow)
        .setTint(tint).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(width * kit(host), width * kit(host));
      group.add(dot);
      return dot;
    });
    host.frame.push((elapsedMs) => dots.forEach((dot, i) => {
      const pose = orbitDotPose(elapsedMs, spec, i);
      dot.setPosition(pose.x * kit(host), pose.y * kit(host)).setAlpha(pose.alpha);
    }));
  }
}

function buildCluster(host: GalaxyLayerHost): void {
  layer(host, host.root, 'cluster');
  const web = layer(host, host.root, 'cluster-web');
  if (web) host.motion.push(host.scene.tweens.add({ targets: web, alpha: { from: 0.55, to: 1 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  breathe(host, layer(host, host.root, 'cluster-core'));
  [300, 800, 1300, 1800].forEach((delay, i) => fadeIn(host, layer(host, host.root, `cluster-galaxies-${i}`), delay));
  [1500, 4200, 6900].forEach((delay, i) => {
    const meteor = layer(host, host.root, `cluster-meteor-${i}`);
    if (!meteor) return;
    meteor.setAlpha(0);
    host.frame.push((elapsedMs) => {
      const pose = meteorPose(elapsedMs, delay);
      meteor.setPosition(pose.dx * kit(host), pose.dy * kit(host)).setAlpha(pose.alpha);
    });
  });
}

function buildPrism(host: GalaxyLayerHost): void {
  const k = kit(host);
  layer(host, host.root, 'prism');
  const beam = layer(host, host.root, 'prism-beam', { x: -1.4, y: 371.8 });
  const fan = layer(host, host.root, 'prism-fan', { x: 175, y: 250 });
  const glass = layer(host, host.root, 'prism-glass', { x: 175, y: 247 });
  if (beam) {
    const beamScale = beam.scaleX;
    intro(host, () => {
      beam.setScale(0);
      introTween(host, { targets: beam, scaleX: beamScale, scaleY: beamScale, duration: 900, ease: 'Sine.easeOut' });
    });
  }
  if (fan) {
    const fanScaleY = fan.scaleY;
    intro(host, () => {
      fan.setScale(fan.scaleX, 0).setAlpha(0);
      introTween(host, {
        targets: fan, scaleY: fanScaleY, alpha: 1, delay: 800, duration: 1300, ease: 'Cubic.easeOut',
        onComplete: () => host.motion.push(host.scene.tweens.add({ targets: fan, alpha: { from: 0.7, to: 1 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })),
      });
    });
  }
  if (glass) {
    const glassScale = glass.scaleX;
    intro(host, () => {
      glass.setScale(glassScale * 0.82).setAlpha(0);
      introTween(host, { targets: glass, scaleX: glassScale, scaleY: glassScale, alpha: 1, delay: 500, duration: 1400, ease: 'Cubic.easeOut' });
    });
  }
  [1400, 1700, 2000].forEach((delay, i) => {
    const shards = layer(host, host.root, `prism-shards-${i}`);
    if (!shards) return;
    fadeIn(host, shards, delay);
    host.motion.push(host.scene.tweens.add({
      targets: shards, y: { from: -5 * k, to: 5 * k }, angle: { from: -1.5, to: 1.5 },
      duration: 2200 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
  });
}

export function buildGalaxyLayers(host: GalaxyLayerHost, themeId: string): void {
  if (themeId === 'ring') buildRing(host);
  else if (themeId === 'cluster') buildCluster(host);
  else if (themeId === 'prism') buildPrism(host);
}
