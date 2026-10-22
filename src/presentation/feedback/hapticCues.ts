import type { HapticsPort, ImpactLevel, NotifyKind } from '../../infrastructure/haptics.ts';
import type { FeedbackEvent } from './feedbackEvents.ts';

export type HapticCue = { kind: 'impact'; style: ImpactLevel } | { kind: 'notify'; type: NotifyKind };

/** `won` không có ở đây: chuỗi thắng rung `success` ở mốc 900 ms */
export const HAPTIC_CUES: Partial<Record<FeedbackEvent['type'], HapticCue>> = {
  lift: { kind: 'impact', style: 'light' },
  snap: { kind: 'impact', style: 'medium' },
  'settle-temporary': { kind: 'impact', style: 'light' },
  rotate: { kind: 'impact', style: 'light' },
  'rotate-blocked': { kind: 'notify', type: 'warning' },
  reset: { kind: 'impact', style: 'light' },
};

export function playCue(port: HapticsPort, cue: HapticCue | undefined): void {
  if (!cue) return;
  if (cue.kind === 'impact') port.impact(cue.style);
  else port.notify(cue.type);
}
