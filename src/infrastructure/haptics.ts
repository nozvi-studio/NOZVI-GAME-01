export type ImpactLevel = 'light' | 'medium' | 'heavy';
export type NotifyKind = 'success' | 'warning';

export type HapticsDriver = {
  impact(style: ImpactLevel): Promise<void>;
  notification(kind: NotifyKind): Promise<void>;
};

export interface HapticsPort {
  impact(style: ImpactLevel): void;
  notify(kind: NotifyKind): void;
}

/** Rung là trang trí: mọi lỗi (thiếu plugin, máy không hỗ trợ) bị nuốt im lặng. */
function safely(run: () => Promise<void>): void {
  try {
    run().catch(() => {});
  } catch {
    // driver ném đồng bộ
  }
}

export function createHaptics(driver: HapticsDriver | null, isEnabled: () => boolean): HapticsPort {
  return {
    impact(style) {
      if (driver && isEnabled()) safely(() => driver.impact(style));
    },
    notify(kind) {
      if (driver && isEnabled()) safely(() => driver.notification(kind));
    },
  };
}
