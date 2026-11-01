import type Phaser from 'phaser';
import type { PrivacyChoices, PrivacyPurpose } from '../application/privacyChoices.ts';

/** main.ts lưu dịch vụ quyền riêng tư vào game.registry dưới khóa này. */
export const PRIVACY_REGISTRY_KEY = 'privacy';

export type PrivacyServices = {
  choices: Pick<PrivacyChoices, 'get' | 'set' | 'userId'> | null;
  /** Mục có trong bản build này (web: chỉ diagnostics). */
  offered: readonly PrivacyPurpose[];
  policyUrl?: string;
};

export const NO_PRIVACY: PrivacyServices = { choices: null, offered: [] };

export function privacyServices(scene: Phaser.Scene): PrivacyServices {
  return (scene.registry?.get(PRIVACY_REGISTRY_KEY) as PrivacyServices | undefined) ?? NO_PRIVACY;
}

/** Mã đủ để người chơi đọc và gửi khi yêu cầu xóa dữ liệu. */
export function shortId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}
