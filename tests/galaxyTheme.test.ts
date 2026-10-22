import { describe, it, expect } from 'vitest';
import { campaignManifest } from '../src/content/manifest.ts';
import { chapterInfo } from '../src/content/chapters.ts';
import {
  GALAXY_THEMES,
  resolveGalaxyTheme,
  resolveCurrentGalaxyTheme,
  getChapterProgress,
  nodeAccent,
  teaserChapters,
} from '../src/presentation/galaxy/galaxyTheme.ts';

describe('galaxyTheme', () => {
  it('has valid theme configs for Chapter 1 and Chapter 2 matching mockup hex values', () => {
    const ch1 = GALAXY_THEMES[1];
    expect(ch1.id).toBe('dwarf');
    expect(ch1.name).toBe('Khởi Nguyên');
    expect(ch1.galaxyType).toBe('Thiên hà lùn');
    expect(ch1.colors.bgTopHex).toBe('#0B2A5E');
    expect(ch1.colors.bgBottomHex).toBe('#123A7A');
    expect(ch1.colors.accentHex).toBe('#5AD1E0');
    expect(ch1.colors.youngStars).toBe(0xff8fc8);

    const ch2 = GALAXY_THEMES[2];
    expect(ch2.id).toBe('spiral');
    expect(ch2.name).toBe('Giao Thoa');
    expect(ch2.galaxyType).toBe('Thiên hà xoắn ốc');
    expect(ch2.colors.bgTopHex).toBe('#2A1670');
    expect(ch2.colors.bgBottomHex).toBe('#3A1A7E');
    expect(ch2.colors.accentHex).toBe('#E58BFF');
    expect(ch2.colors.youngStars).toBe(0xff6fb5);
  });

  it('resolveGalaxyTheme falls back safely to Chapter 1 for unknown chapters', () => {
    expect(resolveGalaxyTheme(1).chapter).toBe(1);
    expect(resolveGalaxyTheme(2).chapter).toBe(2);
    expect(resolveGalaxyTheme(99).chapter).toBe(1);
  });

  it('resolveCurrentGalaxyTheme advances to Chapter 2 when Chapter 1 is fully completed', () => {
    // New player
    expect(resolveCurrentGalaxyTheme([]).chapter).toBe(1);
    // Partway through Chapter 1
    expect(resolveCurrentGalaxyTheme(['1-1', '1-2', '1-3']).chapter).toBe(1);
    // Completing the actual manifest chapter advances the menu theme.
    const ch1All = campaignManifest.filter(e => e.chapter === 1).map(e => e.id);
    expect(resolveCurrentGalaxyTheme(ch1All).chapter).toBe(2);
    const allReleased = campaignManifest.filter(e => e.status === 'approved').map(e => e.id);
    // Xong mọi màn đã duyệt (chương 1–3): chủ đề menu dừng ở chương cuối có màn
    expect(resolveCurrentGalaxyTheme(allReleased).chapter).toBe(3);
  });

  it('calculates chapter progress correctly', () => {
    expect(getChapterProgress(1, [])).toEqual({ completed: 0, total: 10 });
    expect(getChapterProgress(1, ['1-1', '1-2', '2-1'])).toEqual({ completed: 2, total: 10 });
    expect(getChapterProgress(2, ['1-1', '2-1', '2-2', '2-3'])).toEqual({ completed: 3, total: 28 });
    expect(getChapterProgress(1, ['1-1', '1-1', '1-7', 'unknown'])).toEqual({ completed: 2, total: 10 });
  });
});

describe('chapters 3-5 themes (ring, cluster, prism)', () => {
  it('matches the kit values', () => {
    const ring = GALAXY_THEMES[3];
    expect([ring.id, ring.name, ring.galaxyType]).toEqual(['ring', 'Luân Chuyển', 'Thiên hà vòng']);
    expect([ring.colors.bgTopHex, ring.colors.bgBottomHex, ring.colors.accentHex]).toEqual(['#3A1A4E', '#4A2440', '#FFB45A']);
    expect(ring.tagline).toBe('Vật thể Hoag là thiên hà vòng gần như tròn hoàn hảo');
    const cluster = GALAXY_THEMES[4];
    expect([cluster.id, cluster.name, cluster.galaxyType]).toEqual(['cluster', 'Hội Tụ', 'Cụm thiên hà']);
    expect([cluster.colors.bgTopHex, cluster.colors.bgBottomHex, cluster.colors.accentHex]).toEqual(['#140F3A', '#0A0824', '#FFE9A8']);
    expect(cluster.tagline).toBe('Cụm thiên hà Xử Nữ chứa hơn một nghìn thiên hà');
    const prism = GALAXY_THEMES[5];
    expect([prism.id, prism.name, prism.galaxyType]).toEqual(['prism', 'Lăng Kính', 'Vũ trụ lăng kính']);
    expect([prism.colors.bgTopHex, prism.colors.bgBottomHex, prism.colors.accentHex]).toEqual(['#0A0824', '#160A2E', '#7FE3FF']);
    expect(prism.nodeColors).toEqual([0xff5d7a, 0xff9f45, 0xffe15a, 0x4be0b0, 0x4da3ff, 0xb57cff, 0xff7ad9]);
  });

  it('theme names follow the chapter table', () => {
    for (const theme of Object.values(GALAXY_THEMES)) expect(theme.name).toBe(chapterInfo(theme.chapter)?.name);
  });

  it('nodeAccent uses per-level prism colors and the chapter accent elsewhere', () => {
    expect(nodeAccent(GALAXY_THEMES[5], '5-1')).toBe(0xff5d7a);
    expect(nodeAccent(GALAXY_THEMES[5], '5-7')).toBe(0xff7ad9);
    expect(nodeAccent(GALAXY_THEMES[5], '5-8')).toBe(0xff5d7a);
    expect(nodeAccent(GALAXY_THEMES[4], '4-3')).toBe(GALAXY_THEMES[4].colors.accent);
    expect(nodeAccent(GALAXY_THEMES[5], 'dev-x')).toBe(GALAXY_THEMES[5].colors.accent);
  });

  it('teaserChapters lists themed chapters that have no levels', () => {
    expect(teaserChapters(campaignManifest)).toEqual([4, 5]);
    expect(teaserChapters([{ chapter: 1 }, { chapter: 4 }])).toEqual([2, 3, 5]);
  });

  it('keeps the unknown-chapter fallback', () => {
    expect(resolveGalaxyTheme(99).chapter).toBe(1);
    expect(Object.keys(GALAXY_THEMES)).toHaveLength(5);
  });
});
