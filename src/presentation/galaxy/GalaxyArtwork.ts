import Phaser from 'phaser';
import type { GalaxyTheme } from './galaxyTheme.ts';
import { isReducedMotion } from '../transitions/motion.ts';
import { mulberry32 } from '../sky/starField.ts';
import type { ChapterBand } from './constellationLayout.ts';
import { resolveGalaxyTheme } from './galaxyTheme.ts';
import { createGalaxyStars, galaxyStarPose } from './galaxyStars.ts';
import { GALAXY_ART_FILES, isLayeredGalaxy } from './galaxyArtFiles.ts';
import { buildGalaxyLayers } from './galaxyLayers.ts';

/** One continuous texture avoids opaque strips cutting across galaxy artwork. */
export function galaxyMapGradient(scene: Phaser.Scene, bands: readonly ChapterBand[], height: number): string {
  const key = `galaxy-map-sky-${height}`;
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 720, 2048)!;
  const ctx = texture.context;
  const gradient = ctx.createLinearGradient(0, 0, 0, 2048);
  bands.forEach((band, i) => {
    const colors = resolveGalaxyTheme(band.chapter).colors;
    gradient.addColorStop(i === 0 ? 0 : (band.top + 120) / height, colors.bgTopHex);
    gradient.addColorStop(i === bands.length - 1 ? 1 : (band.bottom - 120) / height, colors.bgBottomHex);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 2048);
  const random = mulberry32(712);
  const starCount = 0;
  for (let i = 0; i < starCount; i++) {
    ctx.fillStyle = `rgba(225,239,255,${0.2 + random() * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(random() * 720, random() * 2048, 0.7 + random(), (0.7 + random()) * 2048 / height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  texture.refresh();
  return key;
}

/** SVG filters are rasterized once by the loader, never redrawn each frame. */
export function preloadGalaxyArtwork(scene: Phaser.Scene, themeIds: readonly string[] = ['dwarf', 'spiral']): void {
  for (const id of themeIds) {
    for (const stem of GALAXY_ART_FILES[id] ?? []) {
      const key = `galaxy-${stem}`;
      if (!scene.textures.exists(key)) scene.load.svg(key, `assets/galaxies/${stem}.svg`);
    }
  }
}

export function galaxyGradient(scene: Phaser.Scene, theme: GalaxyTheme): string {
  const key = `galaxy-gradient-${theme.id}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 720, 1600)!;
    const gradient = texture.context.createLinearGradient(0, 0, 0, 1600);
    gradient.addColorStop(0, theme.colors.bgTopHex);
    gradient.addColorStop(1, theme.colors.bgBottomHex);
    texture.context.fillStyle = gradient;
    texture.context.fillRect(0, 0, 720, 1600);
    const random = mulberry32(172 + theme.chapter);
    for (let i = 0; i < 0; i++) {
      texture.context.fillStyle = `rgba(225,239,255,${0.25 + random() * 0.5})`;
      texture.context.beginPath();
      texture.context.arc(random() * 720, random() * 1600, 0.5 + random() * 1.5, 0, Math.PI * 2);
      texture.context.fill();
    }
    texture.refresh();
  }
  return key;
}

const HELD_INTRO_KEY = 'heldIntro';

/** Starts the arrival animation of an artwork built with `deferIntro`; a no-op otherwise or when played already. */
export function playGalaxyIntro(root: Phaser.GameObjects.Container): void {
  const held = root.getData(HELD_INTRO_KEY) as Phaser.Tweens.Tween[] | undefined;
  if (!held) return;
  root.setData(HELD_INTRO_KEY, undefined);
  for (const tween of held) tween.resume();
}

const WHITE_STAR_KEY = 'galaxy-white-star';

/** Soft white glow reused by the drifting stars and the map's twinkles. */
export function ensureWhiteStarTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(WHITE_STAR_KEY)) return WHITE_STAR_KEY;
  const texture = scene.textures.createCanvas(WHITE_STAR_KEY, 32, 32)!;
  const glow = texture.context.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.15, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.45, 'rgba(200,235,255,0.25)');
  glow.addColorStop(1, 'rgba(200,235,255,0)');
  texture.context.fillStyle = glow;
  texture.context.fillRect(0, 0, 32, 32);
  texture.refresh();
  return WHITE_STAR_KEY;
}

/** Solid dot for the unwalked map links: a batched sprite instead of a Graphics circle re-triangulated every frame. */
export function ensureLinkDotTexture(scene: Phaser.Scene): string {
  const key = 'map-link-dot';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 16, 16)!;
  const ctx = texture.context;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(8, 8, 7, 0, Math.PI * 2);
  ctx.fill();
  texture.refresh();
  return key;
}

/** Streak with its bright head on the right edge; rotate it to set the heading. */
export function ensureMeteorTexture(scene: Phaser.Scene): string {
  const key = 'map-meteor';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, 192, 10)!;
  const ctx = texture.context;
  const streak = ctx.createLinearGradient(0, 0, 192, 0);
  streak.addColorStop(0, 'rgba(160,220,255,0)');
  streak.addColorStop(0.85, 'rgba(210,240,255,0.7)');
  streak.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.ellipse(96, 5, 96, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  texture.refresh();
  return key;
}

/** Shared chapter art with a separate motion container for scene choreography. */
export function addGalaxyArtwork(
  scene: Phaser.Scene, theme: GalaxyTheme, x: number, y: number, size: number,
  /** Ring galaxy only: target semi-axes in design units (see GalaxyLayerHost.ring). */
  ring?: { rx: number; ry: number },
  /** Spiral only: colour and spin direction, so repeated galaxies do not look stamped. */
  look?: { tint?: number; spin?: 1 | -1 },
  /** Hold the arrival animation until `playGalaxyIntro(root)`. */
  deferIntro = false,
  /** Show the artwork at rest: no arrival animation at all. */
  skipIntro = false,
): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  // Content sits on a stage so the scene's own fades on `root` do not fight the arrival fade.
  const stage = scene.add.container(0, 0);
  root.add(stage);
  const motion: Phaser.Tweens.Tween[] = [];
  const frame: Array<(elapsedMs: number) => void> = [];
  if (isLayeredGalaxy(theme.id)) {
    const heldIntro: Phaser.Tweens.Tween[] | undefined = deferIntro ? [] : undefined;
    buildGalaxyLayers({ scene, root: stage, size, motion, frame, ring, heldIntro, skipIntro }, theme.id);
    if (heldIntro) root.setData(HELD_INTRO_KEY, heldIntro);
  } else {
    const key = `galaxy-${theme.id === 'spiral' ? 'spiral' : 'dwarf'}`;
    const art = scene.textures.exists(key) ? scene.add.image(0, 0, key).setDisplaySize(size, size) : null;
    if (theme.id !== 'spiral') {
      for (const [i, layer] of ['A', 'B'].entries()) {
        const cloudKey = `galaxy-dwarf-cloud${layer}`;
        if (!scene.textures.exists(cloudKey)) continue;
        const cloud = scene.add.image(0, 0, cloudKey).setDisplaySize(size, size);
        stage.add(cloud);
        motion.push(scene.tweens.add({ targets: cloud, x: i === 0 ? 46 : -46, y: i === 0 ? -18 : 18, alpha: { from: 0.65, to: 1 }, duration: 14000 + i * 5000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      }
      // The dwarf's core breathes, so the haze reads as a living galaxy rather than a still glow.
      if (art) {
        const rest = art.scaleX;
        motion.push(scene.tweens.add({ targets: art, scaleX: rest * 1.05, scaleY: rest * 1.05, alpha: { from: 0.86, to: 1 }, duration: 6500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      }
    }
    if (art) stage.add(art);
    if (deferIntro && !isReducedMotion()) {
      stage.setAlpha(0).setScale(0.9);
      const held = scene.tweens.add({ targets: stage, alpha: 1, scale: 1, duration: 1800, ease: 'Cubic.easeOut', paused: true });
      root.setData(HELD_INTRO_KEY, [held]);
    }
    if (art && theme.id === 'spiral') {
      if (look?.tint !== undefined) art.setTint(look.tint);
      motion.push(scene.tweens.add({ targets: art, angle: 360 * (look?.spin ?? 1), duration: 240000, repeat: -1, ease: 'Linear' }));
    }
  }
  const stars = theme.chapter === 1 ? createGalaxyStars(173) : [];
  const starKey = stars.length ? ensureWhiteStarTexture(scene) : WHITE_STAR_KEY;
  const starViews = stars.map(star => {
    const image = scene.add.image(0, 0, starKey)
      .setName('moving-white-star')
      .setDisplaySize(star.radius * 8, star.radius * 8)
      .setBlendMode(Phaser.BlendModes.ADD);
    stage.add(image);
    return image;
  });
  let elapsedMs = 0;
  const updateMotion = (_time = 0, delta = 0) => {
    const paused = isReducedMotion() || !root.visible;
    motion.forEach(tween => { if (paused) tween.pause(); else tween.resume(); });
    if (!paused) elapsedMs += Math.min(delta, 50);
    starViews.forEach((image, i) => {
      const pose = galaxyStarPose(stars[i], elapsedMs, size);
      image.setPosition(pose.x, pose.y).setAlpha(pose.alpha);
    });
    frame.forEach((animate) => animate(elapsedMs));
  };
  updateMotion();
  scene.events.on(Phaser.Scenes.Events.UPDATE, updateMotion);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, updateMotion);
    motion.forEach(tween => tween.remove());
  });
  return root;
}
