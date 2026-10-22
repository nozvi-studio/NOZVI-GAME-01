import { App } from '@capacitor/app';

export type LifecycleCallbacks = {
  onHardwareBack?: () => void;
  onBackground?: () => void;
  onResume?: () => void;
};

/**
 * Thiết lập lắng nghe sự kiện vòng đời ứng dụng Android (Hardware Back Button & App State Change).
 */
export function setupAndroidLifecycle(callbacks: LifecycleCallbacks): () => void {
  let backHandle: { remove: () => Promise<void> } | null = null;
  let stateHandle: { remove: () => Promise<void> } | null = null;

  try {
    App.addListener('backButton', () => {
      if (callbacks.onHardwareBack) {
        callbacks.onHardwareBack();
      }
    }).then((handle) => {
      backHandle = handle;
    });

    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        callbacks.onResume?.();
      } else {
        callbacks.onBackground?.();
      }
    }).then((handle) => {
      stateHandle = handle;
    });
  } catch {
    // Không chạy trong môi trường native Capacitor (ví dụ: browser thuần)
  }

  return () => {
    backHandle?.remove();
    stateHandle?.remove();
  };
}
