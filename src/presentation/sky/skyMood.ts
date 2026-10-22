export type SkyMood = 'menu' | 'map' | 'play';

export type MoodState = { driftSpeed: number; dim: number };

/** Sao trôi ở bản đồ; tối 15% ở màn chơi để tấm bia nổi lên. */
export const SKY_MOODS: Record<SkyMood, MoodState> = {
  menu: { driftSpeed: 0, dim: 0 },
  map: { driftSpeed: 1, dim: 0 },
  play: { driftSpeed: 0, dim: 0.35 },
};

/**
 * Quãng trôi tính bằng ms "chạy đủ tốc độ". Cộng dồn theo tốc độ hiện tại nên
 * khi tween tốc độ về 0, sao chậm dần rồi dừng tại chỗ chứ không giật về vị
 * trí cũ.
 */
export function advanceDrift(driftMs: number, deltaMs: number, driftSpeed: number): number {
  return driftMs + deltaMs * Math.max(0, driftSpeed);
}

export interface MoodTarget {
  setMood(mood: SkyMood, durationMs: number): void;
}
