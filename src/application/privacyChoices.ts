export type PrivacyPurpose = 'analytics' | 'diagnostics' | 'ads';
export type PrivacyState = { analytics: boolean; diagnostics: boolean; ads: boolean };

export const PRIVACY_STORAGE_KEY = 'nozvi.privacy.v3';

export interface PrivacyChoices {
  get(): PrivacyState;
  decided(): boolean;
  acceptedLegalVersion(): string | null;
  /** Legal acceptance is independent of optional data-processing choices. */
  acceptLegal(version: string): void;
  /** Lưu lựa chọn, đánh dấu đã quyết định và báo cho người nghe. Rút lại thống kê thì đổi userId. */
  set(next: Partial<PrivacyState>): void;
  /** Mã ngẫu nhiên gửi kèm thống kê; người chơi đưa mã này khi yêu cầu xóa dữ liệu. */
  userId(): string;
  onChange(listener: (state: PrivacyState) => void): () => void;
}

type Stored = PrivacyState & { decided: boolean; userId: string; acceptedLegalVersion: string | null };

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Stored>;
    if (
      typeof v.analytics !== 'boolean' ||
      typeof v.diagnostics !== 'boolean' ||
      typeof v.ads !== 'boolean' ||
      typeof v.decided !== 'boolean' ||
      typeof v.userId !== 'string' ||
      v.userId.length === 0
    ) {
      return null;
    }
    return {
      analytics: v.analytics, diagnostics: v.diagnostics, ads: v.ads, decided: v.decided, userId: v.userId,
      acceptedLegalVersion: typeof v.acceptedLegalVersion === 'string' ? v.acceptedLegalVersion : null,
    };
  } catch {
    return null;
  }
}

/** Nguồn sự thật duy nhất cho đồng ý thống kê và báo lỗi. Storage hỏng thì chạy trong bộ nhớ, lần mở sau hỏi lại. */
export function createPrivacyChoices(
  store: Pick<Storage, 'getItem' | 'setItem'>,
  newId: () => string = randomId
): PrivacyChoices {
  let raw: string | null = null;
  let readFailed = false;
  try {
    raw = store.getItem(PRIVACY_STORAGE_KEY);
  } catch {
    readFailed = true;
  }
  const parsed = parse(raw);
  let state: Stored = parsed ?? {
    analytics: false, diagnostics: false, ads: false, decided: false, userId: newId(), acceptedLegalVersion: null,
  };
  const listeners = new Set<(s: PrivacyState) => void>();

  const persist = (): void => {
    try {
      store.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Không ghi được: giữ trong bộ nhớ cho phiên này.
    }
  };
  // Lần đầu (hoặc dữ liệu hỏng): ghi ngay để userId được giữ qua các lần mở.
  // Đọc lỗi tạm thời thì không ghi đè bản hợp lệ đang lưu; lần `set` đầu sẽ ghi.
  if (!parsed && !readFailed) persist();

  return {
    get: () => ({ analytics: state.analytics, diagnostics: state.diagnostics, ads: state.ads }),
    decided: () => state.decided,
    acceptedLegalVersion: () => state.acceptedLegalVersion,
    acceptLegal(version) {
      state = { ...state, acceptedLegalVersion: version };
      persist();
    },
    userId: () => state.userId,
    set(next) {
      const withdrawnAnalytics = state.analytics && next.analytics === false;
      state = {
        ...state,
        analytics: next.analytics ?? state.analytics,
        diagnostics: next.diagnostics ?? state.diagnostics,
        ads: next.ads ?? state.ads,
        decided: true,
        userId: withdrawnAnalytics ? newId() : state.userId,
      };
      persist();
      const snapshot = { analytics: state.analytics, diagnostics: state.diagnostics, ads: state.ads };
      for (const listener of [...listeners]) {
        try {
          listener(snapshot);
        } catch {
          // Một người nghe hỏng không chặn người khác.
        }
      }
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
