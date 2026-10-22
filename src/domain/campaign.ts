import type { ManifestEntry } from '../content/document.ts';

export type LevelAccessStatus = {
  unlocked: boolean;
  completed: boolean;
  available: boolean;
};

export type LevelAccessMode = 'campaign' | 'harness';

/**
 * Xác định quyền truy cập của một màn chơi trong campaign.
 * - unlocked: màn đầu tiên (order 1) luôn mở khóa; các màn sau mở khóa khi màn liền trước đã hoàn thành.
 * - completed: ID đã nằm trong danh sách completed.
 * - available: campaign cần `approved`; harness dev nhận cả `validated`.
 */
export function levelAccess(
  manifest: readonly ManifestEntry[],
  completed: readonly string[],
  id: string,
  mode: LevelAccessMode = 'campaign'
): LevelAccessStatus {
  const entry = manifest.find((e) => e.id === id);
  if (!entry) {
    return { unlocked: false, completed: false, available: false };
  }

  const isCompleted = completed.includes(id);
  const isAvailable = entry.status === 'approved' || (mode === 'harness' && entry.status === 'validated');

  let isUnlocked = false;
  if (entry.order === 1) {
    isUnlocked = true;
  } else {
    const predecessor = manifest.find((e) => e.order === entry.order - 1);
    isUnlocked = predecessor ? completed.includes(predecessor.id) : false;
  }

  return {
    unlocked: isUnlocked,
    completed: isCompleted,
    available: isAvailable,
  };
}

/**
 * Tiến độ dùng để vẽ bản đồ. Harness bổ sung tạm các màn authored từ đầu
 * chiến dịch tới màn vừa thắng, nhưng không ghi chúng vào progress campaign.
 */
export function resolveMapCompletedLevels(
  manifest: readonly ManifestEntry[],
  campaignCompleted: readonly string[],
  mode: LevelAccessMode,
  previewCompletedThrough?: string
): string[] {
  const completed = new Set(campaignCompleted);
  if (mode !== 'harness' || !previewCompletedThrough) return [...completed];

  const through = manifest.find((entry) => entry.id === previewCompletedThrough);
  if (!through || !['validated', 'approved'].includes(through.status)) return [...completed];

  for (const entry of manifest) {
    if (entry.order > through.order) continue;
    if (entry.status === 'validated' || entry.status === 'approved') completed.add(entry.id);
  }
  return [...completed];
}

/** Chọn mốc có order lớn nhất để preview harness không lùi khi chơi lại màn cũ. */
export function furthestLevelId(
  manifest: readonly ManifestEntry[],
  ...ids: Array<string | undefined>
): string | undefined {
  let furthest: ManifestEntry | undefined;
  for (const id of ids) {
    if (!id) continue;
    const entry = manifest.find((candidate) => candidate.id === id);
    if (entry && (!furthest || entry.order > furthest.order)) furthest = entry;
  }
  return furthest?.id;
}

/**
 * Tìm ID của màn chơi kế tiếp trong campaign theo thứ tự order.
 */
export function nextLevelId(
  manifest: readonly ManifestEntry[],
  id: string
): string | null {
  const current = manifest.find((e) => e.id === id);
  if (!current) return null;

  const next = manifest.find((e) => e.order === current.order + 1);
  return next ? next.id : null;
}

export type NextLevelResolution = {
  level: ManifestEntry;
  type: 'start' | 'continue' | 'replay';
};

/**
 * Xác định màn chơi chiến dịch tiếp theo an toàn:
 * - Ưu tiên màn chưa hoàn thành, đã mở khóa và ĐÃ KIỂM DUYỆT (approved).
 * - Nếu người chơi đã hoàn thành hết các màn đã duyệt (ví dụ 1-1 xong, 1-2 đang hoàn thiện),
 *   trả về màn đã duyệt gần nhất để chơi lại, tuyệt đối không trỏ vào màn unavailable gây crash.
 */
export function resolveNextCampaignLevel(
  manifest: readonly ManifestEntry[],
  completed: readonly string[]
): NextLevelResolution {
  const nextPlayable = manifest.find((entry) => {
    const access = levelAccess(manifest, completed, entry.id);
    return access.unlocked && access.available && !access.completed;
  });

  if (nextPlayable) {
    return {
      level: nextPlayable,
      type: completed.length === 0 ? 'start' : 'continue',
    };
  }

  const lastApprovedCompleted = [...manifest]
    .reverse()
    .find((m) => completed.includes(m.id) && m.status === 'approved');

  return {
    level: lastApprovedCompleted ?? manifest[0],
    type: 'replay',
  };
}
