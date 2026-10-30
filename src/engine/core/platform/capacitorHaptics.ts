import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticsDriver } from './haptics.ts';

const IMPACT = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
const NOTIFY = { success: NotificationType.Success, warning: NotificationType.Warning } as const;

export function capacitorHapticsDriver(): HapticsDriver {
  return {
    impact: (style) => Haptics.impact({ style: IMPACT[style] }),
    notification: (kind) => Haptics.notification({ type: NOTIFY[kind] }),
  };
}
