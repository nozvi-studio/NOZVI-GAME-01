/**
 * Định nghĩa bộ nhận diện Galaxy Theme cho từng chương (Galaxy Theme Tokens)
 *
 * Tham khảo chi tiết từ mockup thiết kế GDD:
 * - docs/gdd/assets/Bộ nhận diện năm thiên hà-html/GalaxyKit.dc.html
 * - docs/gdd/assets/Menu · Chương I Khởi Nguyên-html/Menu1.dc.html
 * - docs/gdd/assets/Menu · Chương II Giao Thoa-html/Menu2.dc.html
 * - docs/gdd/assets/Menu · Chương III Luân Chuyển-html/Menu3.dc.html (ring galaxy, campaign chapter 3)
 * - docs/gdd/assets/Menu · Chương IV Hội Tụ-html/Menu4.dc.html (cluster galaxy, campaign chapter 4)
 * - docs/gdd/assets/Chọn màn · bản đồ 5 thiên hà (cuộn dọc)-html/GalaxyMap.dc.html
 */

import { campaignManifest } from '../../content/manifest.ts';
import { resolveNextCampaignLevel } from '../../domain/campaign.ts';
import type { Chapter } from '../../domain/model.ts';

export interface GalaxyThemeColors {
  /** Màu gradient đỉnh bầu trời */
  bgTop: number;
  /** Màu gradient đáy bầu trời */
  bgBottom: number;
  bgTopHex: string;
  bgBottomHex: string;

  /** Màu nhấn chủ đạo (viền nút, thanh tiến độ, điểm sáng) */
  accent: number;
  accentHex: string;
  accentGlow: number;
  /** Màu nền kính tối cho dialog/pill (kết hợp alpha 0.5 - 0.7) */
  accentDark: number;

  /** Màu các khối mây khí trong thiên hà */
  clouds: {
    primary: number;
    secondary: number;
    tertiary: number;
    highlight: number;
  };

  /** Màu các hạt sao trẻ nhấp nháy đặc trưng */
  youngStars: number;
}

export interface GalaxyTheme {
  chapter: number;
  id: string;
  name: string;
  galaxyType: string;
  totalLevels: number;
  tagline: string;
  colors: GalaxyThemeColors;
  portal: {
    color: number;
    ringColor: number;
  };
  /** Optional per-level node colors (prism chapter): index = level number - 1, wraps. */
  nodeColors?: readonly number[];
}

export const GALAXY_THEMES: Readonly<Record<number, GalaxyTheme>> = {
  1: {
    chapter: 1,
    id: 'dwarf',
    name: 'Khởi Nguyên',
    galaxyType: 'Thiên hà lùn',
    totalLevels: campaignManifest.filter(entry => entry.chapter === 1).length,
    tagline: 'Đám Mây Magellan Lớn là một thiên hà lùn quay quanh Ngân Hà',
    colors: {
      bgTop: 0x0b2a5e,
      bgBottom: 0x123a7a,
      bgTopHex: '#0B2A5E',
      bgBottomHex: '#123A7A',
      accent: 0x5ad1e0,
      accentHex: '#5AD1E0',
      accentGlow: 0x5ad1e0,
      accentDark: 0x0a0a28,
      clouds: {
        primary: 0x3fa9f5,
        secondary: 0x5ad1e0,
        tertiary: 0x7b8cff,
        highlight: 0x9bf0ff,
      },
      youngStars: 0xff8fc8,
    },
    portal: {
      color: 0x5ad1e0,
      ringColor: 0xffffff,
    },
  },
  2: {
    chapter: 2,
    id: 'spiral',
    name: 'Giao Thoa',
    galaxyType: 'Thiên hà xoắn ốc',
    totalLevels: campaignManifest.filter(entry => entry.chapter === 2).length,
    tagline: 'Ngân Hà của chúng ta là một thiên hà xoắn ốc có thanh ở giữa',
    colors: {
      bgTop: 0x2a1670,
      bgBottom: 0x3a1a7e,
      bgTopHex: '#2A1670',
      bgBottomHex: '#3A1A7E',
      accent: 0xe58bff,
      accentHex: '#E58BFF',
      accentGlow: 0xe58bff,
      accentDark: 0x120e36,
      clouds: {
        primary: 0x8e5cff,
        secondary: 0xe58bff,
        tertiary: 0x8fa8ff,
        highlight: 0xffb8e6,
      },
      youngStars: 0xff6fb5,
    },
    portal: {
      color: 0xe58bff,
      ringColor: 0xffffff,
    },
  },
  3: {
    chapter: 3,
    id: 'ring',
    name: 'Luân Chuyển',
    galaxyType: 'Thiên hà vòng',
    totalLevels: campaignManifest.filter(entry => entry.chapter === 3).length,
    tagline: 'Vật thể Hoag là thiên hà vòng gần như tròn hoàn hảo',
    colors: {
      bgTop: 0x3a1a4e,
      bgBottom: 0x4a2440,
      bgTopHex: '#3A1A4E',
      bgBottomHex: '#4A2440',
      accent: 0xffb45a,
      accentHex: '#FFB45A',
      accentGlow: 0xffb45a,
      accentDark: 0x120e36,
      clouds: {
        primary: 0xff9e5a,
        secondary: 0xffb45a,
        tertiary: 0xffe2a8,
        highlight: 0x9fd8ff,
      },
      youngStars: 0x9fd8ff,
    },
    portal: {
      color: 0xffb45a,
      ringColor: 0xffffff,
    },
  },
  4: {
    chapter: 4,
    id: 'cluster',
    name: 'Hội Tụ',
    galaxyType: 'Cụm thiên hà',
    totalLevels: campaignManifest.filter(entry => entry.chapter === 4).length,
    tagline: 'Cụm thiên hà Xử Nữ chứa hơn một nghìn thiên hà',
    colors: {
      bgTop: 0x140f3a,
      bgBottom: 0x0a0824,
      bgTopHex: '#140F3A',
      bgBottomHex: '#0A0824',
      accent: 0xffe9a8,
      accentHex: '#FFE9A8',
      accentGlow: 0xffe9a8,
      accentDark: 0x120e36,
      clouds: {
        primary: 0x9fb4ff,
        secondary: 0xffe9a8,
        tertiary: 0xffc857,
        highlight: 0xffffff,
      },
      youngStars: 0xffe9a8,
    },
    portal: {
      color: 0xffe9a8,
      ringColor: 0xffffff,
    },
  },
  5: {
    chapter: 5,
    id: 'prism',
    name: 'Lăng Kính',
    galaxyType: 'Vũ trụ lăng kính',
    totalLevels: campaignManifest.filter(entry => entry.chapter === 5).length,
    tagline: 'Lăng kính tách tia sáng trắng thành dải màu',
    colors: {
      bgTop: 0x0a0824,
      bgBottom: 0x160a2e,
      bgTopHex: '#0A0824',
      bgBottomHex: '#160A2E',
      accent: 0x7fe3ff,
      accentHex: '#7FE3FF',
      accentGlow: 0x7fe3ff,
      accentDark: 0x120e36,
      clouds: {
        primary: 0xb9a8ff,
        secondary: 0x4da3ff,
        tertiary: 0xff7ad9,
        highlight: 0xffffff,
      },
      youngStars: 0x4be0b0,
    },
    portal: {
      color: 0xff7ad9,
      ringColor: 0xffffff,
    },
    nodeColors: [0xff5d7a, 0xff9f45, 0xffe15a, 0x4be0b0, 0x4da3ff, 0xb57cff, 0xff7ad9],
  },
};

/**
 * Lấy theme thiên hà theo số thứ tự chương (mặc định fallback về Chương 1 nếu chưa hỗ trợ)
 */
export function resolveGalaxyTheme(chapter: number): GalaxyTheme {
  return GALAXY_THEMES[chapter] ?? GALAXY_THEMES[1];
}

/**
 * Suy ra theme chương hiện tại dựa trên danh sách các màn chơi đã hoàn thành.
 * Ví dụ: Đã vượt 1-1..1-7 thì màn tiếp theo thuộc Chương 2 -> trả về Theme Chương 2.
 */
export function resolveCurrentGalaxyTheme(completedLevels: readonly string[]): GalaxyTheme {
  return resolveGalaxyTheme(resolveNextCampaignLevel(campaignManifest, completedLevels).level.chapter);
}

/**
 * Tính số màn đã hoàn thành trong một chương cụ thể
 */
export function getChapterProgress(
  chapter: number,
  completedLevels: readonly string[]
): { completed: number; total: number } {
  const entries = campaignManifest.filter(entry => entry.chapter === chapter);
  return { completed: entries.filter(entry => completedLevels.includes(entry.id)).length, total: entries.length };
}

/** Accent for one level's node: prism levels carry their own colour. */
export function nodeAccent(theme: GalaxyTheme, levelId: string): number {
  const order = Number(/-(\d+)$/.exec(levelId)?.[1]);
  const colors = theme.nodeColors;
  return colors && Number.isInteger(order) && order > 0 ? colors[(order - 1) % colors.length] : theme.colors.accent;
}

/** Themed chapters with no manifest entry yet; the map shows them as banner-only bands. */
export function teaserChapters(manifest: readonly { chapter: number }[]): Chapter[] {
  return Object.keys(GALAXY_THEMES)
    .map(Number)
    .filter((chapter) => !manifest.some((entry) => entry.chapter === chapter))
    .sort((a, b) => a - b) as Chapter[];
}
