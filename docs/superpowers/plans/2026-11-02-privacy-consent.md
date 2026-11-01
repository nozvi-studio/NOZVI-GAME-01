# Privacy Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players choose separately whether to share gameplay analytics (GameAnalytics) and crash diagnostics (Sentry); declining never blocks play, and choices can be changed in Settings with immediate effect.

**Architecture:** A pure `PrivacyChoices` store (application layer) is the single source of truth. The GameAnalytics driver and the Sentry driver subscribe to it and start, stop or skip work accordingly; the existing `CrashReporterPort` / `AnalyticsPort` stay unchanged. A DOM overlay asks on first launch; a Phaser `PrivacyDialog` opened from Settings lets players change their mind.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest 2.1.8 (node environment, no jsdom), Capacitor (Android), `gameanalytics` 5.0.0, `@sentry/browser` 11.9.0.

**Spec:** `docs/superpowers/specs/2026-11-02-privacy-consent-design.md`

## Global Constraints

- Storage key: `nozvi.privacy.v2`, JSON `{ "analytics": boolean, "diagnostics": boolean, "decided": boolean, "userId": string }`. The old key `nozvi.analytics.consent.v1` is ignored.
- Both choices default to `false` until the player decides.
- Withdrawing analytics replaces `userId` with a new random UUID.
- Platforms: web offers only `diagnostics`; Android offers `analytics` (when both GA keys are set) and `diagnostics` (when a Sentry DSN is set).
- First-launch screen: "Reject all" and "Accept all" equal in size and weight, plus "Options" revealing one switch per offered purpose (default off) and "Save choices".
- Settings: the conditional UMP row is replaced by an always-visible "Privacy ›" row opening `PrivacyDialog`.
- Policy URL comes from `VITE_PRIVACY_POLICY_URL`; the link is hidden when unset.
- Engine boundary: files in `src/engine/core` import nothing outside `src/engine/core` (`engineBoundary` test).
- Scene changes only through `director.go(...)`; this plan adds no scene.
- All ten locales (en-US, es, pt-BR, fr, de, ja, ko, zh-CN, id, vi) get identical keys (`localizationCoverage` test).
- Before declaring done: `npm run typecheck` and `npm test`; update `STATUS.md` and `CHANGELOG.md`.
- Commits follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `src/application/privacyChoices.ts` | Create | Choice store: read, write, userId, listeners |
| `src/infrastructure/gameAnalyticsStore.ts` | Create | Remove the GA SDK's unsent-event keys from localStorage |
| `src/infrastructure/gameAnalyticsDriver.ts` | Modify | Follow `PrivacyChoices`; `configureUserId`; stop on withdrawal |
| `src/infrastructure/gameAnalyticsSdk.ts` | Modify | Expose `configureUserId`, `setEnabledEventSubmission` |
| `src/infrastructure/analyticsSetup.ts` | Modify | Pass `PrivacyChoices` to the driver |
| `src/infrastructure/analyticsConsent.ts` | Delete | Replaced by `PrivacyChoices` |
| `src/engine/core/platform/sentryCrashDriver.ts` | Modify | Optional `ConsentGate`: init only when enabled, `close` on withdrawal |
| `src/presentation/consent/consentModel.ts` | Create | Pure state of the first-launch screen |
| `src/presentation/consent/consentGate.ts` | Rewrite | DOM overlay rendering `consentModel` |
| `src/presentation/privacyServices.ts` | Create | Registry key + accessor for dialogs |
| `src/presentation/dialogs/PrivacyDialog.ts` | Create | Phaser dialog: switches, ads row, ID + copy, policy link |
| `src/presentation/dialogs/SettingsDialog.ts` | Modify | Replace the UMP row with the "Privacy" row |
| `src/localization/types.ts`, `src/locales/*/common.json` | Modify | New `privacy_*` keys |
| `src/main.ts`, `src/vite-env.d.ts` | Modify | Wiring, `VITE_PRIVACY_POLICY_URL` |
| Tests under `tests/` | Create / modify | One file per unit above |

---

### Task 1: `PrivacyChoices` store

**Files:**
- Create: `src/application/privacyChoices.ts`
- Test: `tests/privacyChoices.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PrivacyPurpose = 'analytics' | 'diagnostics';
  export type PrivacyState = { analytics: boolean; diagnostics: boolean };
  export const PRIVACY_STORAGE_KEY = 'nozvi.privacy.v2';
  export interface PrivacyChoices {
    get(): PrivacyState;
    decided(): boolean;
    set(next: Partial<PrivacyState>): void;
    userId(): string;
    onChange(listener: (state: PrivacyState) => void): () => void;
  }
  export function createPrivacyChoices(
    store: Pick<Storage, 'getItem' | 'setItem'>,
    newId?: () => string
  ): PrivacyChoices;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/privacyChoices.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createPrivacyChoices, PRIVACY_STORAGE_KEY } from '../src/application/privacyChoices.ts';

function memory(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PRIVACY_STORAGE_KEY, initial);
  return { map, store: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) } };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('createPrivacyChoices', () => {
  test('mặc định tắt cả hai và chưa quyết định', () => {
    const c = createPrivacyChoices(memory().store, ids());
    expect(c.get()).toEqual({ analytics: false, diagnostics: false });
    expect(c.decided()).toBe(false);
  });

  test('set lưu xuống storage, đánh dấu đã quyết định, đọc lại đúng', () => {
    const m = memory();
    createPrivacyChoices(m.store, ids()).set({ analytics: true, diagnostics: false });
    const again = createPrivacyChoices(m.store, ids());
    expect(again.get()).toEqual({ analytics: true, diagnostics: false });
    expect(again.decided()).toBe(true);
  });

  test('userId ổn định giữa các lần mở', () => {
    const m = memory();
    const first = createPrivacyChoices(m.store, ids()).userId();
    expect(createPrivacyChoices(m.store, () => 'other').userId()).toBe(first);
  });

  test('rút lại thống kê thì tạo userId mới; bật lại thì giữ', () => {
    const c = createPrivacyChoices(memory().store, ids());
    c.set({ analytics: true });
    const before = c.userId();
    c.set({ analytics: false });
    const after = c.userId();
    expect(after).not.toBe(before);
    c.set({ analytics: true });
    expect(c.userId()).toBe(after);
  });

  test('chỉ đổi diagnostics thì không đổi userId', () => {
    const c = createPrivacyChoices(memory().store, ids());
    c.set({ analytics: true });
    const id = c.userId();
    c.set({ diagnostics: true });
    expect(c.userId()).toBe(id);
  });

  test('JSON hỏng hoặc sai kiểu thì coi như chưa quyết định', () => {
    expect(createPrivacyChoices(memory('{oops').store, ids()).decided()).toBe(false);
    expect(createPrivacyChoices(memory('{"analytics":"yes","decided":true}').store, ids()).get()).toEqual({
      analytics: false,
      diagnostics: false,
    });
  });

  test('storage ném lỗi thì vẫn chạy trong bộ nhớ', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    const c = createPrivacyChoices(broken, ids());
    c.set({ diagnostics: true });
    expect(c.get().diagnostics).toBe(true);
  });

  test('onChange báo trạng thái mới và hủy đăng ký được', () => {
    const c = createPrivacyChoices(memory().store, ids());
    const seen = vi.fn();
    const off = c.onChange(seen);
    c.set({ analytics: true });
    off();
    c.set({ analytics: false });
    expect(seen).toHaveBeenCalledOnce();
    expect(seen).toHaveBeenCalledWith({ analytics: true, diagnostics: false });
  });

  test('listener ném lỗi không chặn listener khác', () => {
    const c = createPrivacyChoices(memory().store, ids());
    const ok = vi.fn();
    c.onChange(() => { throw new Error('x'); });
    c.onChange(ok);
    c.set({ analytics: true });
    expect(ok).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/privacyChoices.test.ts`
Expected: FAIL, cannot resolve `../src/application/privacyChoices.ts`.

- [ ] **Step 3: Write the implementation**

```ts
// src/application/privacyChoices.ts
export type PrivacyPurpose = 'analytics' | 'diagnostics';
export type PrivacyState = { analytics: boolean; diagnostics: boolean };

export const PRIVACY_STORAGE_KEY = 'nozvi.privacy.v2';

export interface PrivacyChoices {
  get(): PrivacyState;
  decided(): boolean;
  /** Lưu lựa chọn, đánh dấu đã quyết định và báo cho người nghe. Rút lại thống kê thì đổi userId. */
  set(next: Partial<PrivacyState>): void;
  /** Mã ngẫu nhiên gửi kèm thống kê; người chơi đưa mã này khi yêu cầu xóa dữ liệu. */
  userId(): string;
  onChange(listener: (state: PrivacyState) => void): () => void;
}

type Stored = PrivacyState & { decided: boolean; userId: string };

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
      typeof v.decided !== 'boolean' ||
      typeof v.userId !== 'string' ||
      v.userId.length === 0
    ) {
      return null;
    }
    return { analytics: v.analytics, diagnostics: v.diagnostics, decided: v.decided, userId: v.userId };
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
  try {
    raw = store.getItem(PRIVACY_STORAGE_KEY);
  } catch {
    raw = null;
  }
  let state: Stored = parse(raw) ?? { analytics: false, diagnostics: false, decided: false, userId: newId() };
  const listeners = new Set<(s: PrivacyState) => void>();

  const persist = (): void => {
    try {
      store.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Không ghi được: giữ trong bộ nhớ cho phiên này.
    }
  };

  return {
    get: () => ({ analytics: state.analytics, diagnostics: state.diagnostics }),
    decided: () => state.decided,
    userId: () => state.userId,
    set(next) {
      const withdrawnAnalytics = state.analytics && next.analytics === false;
      state = {
        analytics: next.analytics ?? state.analytics,
        diagnostics: next.diagnostics ?? state.diagnostics,
        decided: true,
        userId: withdrawnAnalytics ? newId() : state.userId,
      };
      persist();
      const snapshot = { analytics: state.analytics, diagnostics: state.diagnostics };
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/privacyChoices.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/application/privacyChoices.ts tests/privacyChoices.test.ts
git commit -m "feat: add PrivacyChoices store for analytics and diagnostics consent"
```

---

### Task 2: GameAnalytics follows `PrivacyChoices`

**Files:**
- Create: `src/infrastructure/gameAnalyticsStore.ts`
- Modify: `src/infrastructure/gameAnalyticsDriver.ts` (whole file), `src/infrastructure/gameAnalyticsSdk.ts`, `src/infrastructure/analyticsSetup.ts`
- Delete: `src/infrastructure/analyticsConsent.ts`, `tests/analyticsConsent.test.ts`
- Test: `tests/gameAnalyticsDriver.test.ts` (update), `tests/gameAnalyticsStore.test.ts` (new), `tests/analyticsSetup.test.ts` (update)

**Interfaces:**
- Consumes: `PrivacyChoices`, `PrivacyState` from Task 1.
- Produces:
  ```ts
  // gameAnalyticsStore.ts
  export const GA_STORE_KEYS: readonly string[]; // ['ga_event','ga_session','ga_progression','ga_items']
  export function clearGameAnalyticsStore(store: Pick<Storage, 'removeItem'> | null, gameKey: string): void;
  // gameAnalyticsDriver.ts
  export type GameAnalyticsLike = { ...existing, configureUserId(id: string): void; setEnabledEventSubmission(flag: boolean): void };
  export type AnalyticsPrivacy = Pick<PrivacyChoices, 'get' | 'userId' | 'onChange'>;
  export function createGameAnalyticsDriver(
    config: GameAnalyticsConfig,
    load: () => Promise<GameAnalyticsLike>,
    privacy: AnalyticsPrivacy,
    options?: GameAnalyticsOptions & { store?: Pick<Storage, 'removeItem'> | null }
  ): GameAnalyticsDriver;
  // analyticsSetup.ts
  export type AnalyticsSelectionInput = { ...existing, privacy: AnalyticsPrivacy };
  ```

Behaviour (from the SDK source, `gameanalytics` 5.0.0): the SDK persists unsent events at `GA::<gameKey>::ga_event` (plus `ga_session`, `ga_progression`, `ga_items`); `configureUserId` only works before `initialize`. Therefore:
- On creation with analytics off: clear the store (removes leftovers from a session that was withdrawn).
- analytics on, SDK not started: load, `configureBuild`, `configureUserId(privacy.userId())`, `initialize`.
- analytics turned off: if the SDK started, `setEnabledEventSubmission(false)`; mark the session stopped; clear the store.
- analytics turned on again after the SDK started in this session: stay stopped until the next launch (the user id cannot change while running).
- analytics turned on and SDK never started: warm up now.

- [ ] **Step 1: Write the failing store test**

```ts
// tests/gameAnalyticsStore.test.ts
import { describe, expect, test } from 'vitest';
import { clearGameAnalyticsStore } from '../src/infrastructure/gameAnalyticsStore.ts';

describe('clearGameAnalyticsStore', () => {
  test('xóa đúng bốn key của SDK theo gameKey và giữ key khác', () => {
    const map = new Map<string, string>([
      ['GA::gk::ga_event', '[1]'],
      ['GA::gk::ga_session', '[2]'],
      ['GA::gk::ga_progression', '[3]'],
      ['GA::gk::ga_items', '[4]'],
      ['GA::other::ga_event', '[5]'],
      ['nozvi.progress', '{}'],
    ]);
    clearGameAnalyticsStore({ removeItem: (k) => void map.delete(k) }, 'gk');
    expect([...map.keys()]).toEqual(['GA::other::ga_event', 'nozvi.progress']);
  });

  test('storage null hoặc ném lỗi thì không ném', () => {
    expect(() => clearGameAnalyticsStore(null, 'gk')).not.toThrow();
    expect(() => clearGameAnalyticsStore({ removeItem: () => { throw new Error('x'); } }, 'gk')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/gameAnalyticsStore.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the store helper**

```ts
// src/infrastructure/gameAnalyticsStore.ts
/** Khóa localStorage mà SDK gameanalytics 5.0.0 dùng (`GA::<gameKey>::<key>`, xem GAStore trong SDK). */
export const GA_STORE_KEYS: readonly string[] = ['ga_event', 'ga_session', 'ga_progression', 'ga_items'];

/** Xóa sự kiện chưa gửi và trạng thái phiên của SDK khi người chơi rút lại đồng ý. */
export function clearGameAnalyticsStore(store: Pick<Storage, 'removeItem'> | null, gameKey: string): void {
  if (!store) return;
  for (const key of GA_STORE_KEYS) {
    try {
      store.removeItem(`GA::${gameKey}::${key}`);
    } catch {
      // Không xóa được thì thôi; SDK đã ngừng gửi.
    }
  }
}
```

Run: `npx vitest run tests/gameAnalyticsStore.test.ts` → PASS.

- [ ] **Step 4: Update the driver tests (failing)**

In `tests/gameAnalyticsDriver.test.ts`:

1. Add the import and a privacy fake under the existing imports:
```ts
import type { PrivacyState } from '../src/application/privacyChoices.ts';

function fakePrivacy(initial: Partial<PrivacyState> = { analytics: true }) {
  let state: PrivacyState = { analytics: false, diagnostics: false, ...initial };
  let id = 'user-1';
  const listeners = new Set<(s: PrivacyState) => void>();
  return {
    get: () => state,
    userId: () => id,
    onChange: (l: (s: PrivacyState) => void) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    change(next: Partial<PrivacyState>, newId?: string) {
      state = { ...state, ...next };
      if (newId) id = newId;
      for (const l of listeners) l(state);
    },
  };
}
```
2. Extend `fakeSdk()` with the two new methods:
```ts
    configureUserId: (...a) => void calls.push(['configureUserId', ...a]),
    setEnabledEventSubmission: (...a) => void calls.push(['submission', ...a]),
```
3. Replace every third argument `() => true` with `fakePrivacy()` and every `() => false` with `fakePrivacy({ analytics: false })` (search the file for `async () => sdk, () =>`).
4. Change the expectation in `'đồng ý thì cấu hình build, khởi tạo đúng một lần rồi gửi theo thứ tự'` so the order includes the user id: `['configureBuild', '1.0.0'], ['configureUserId', 'user-1'], ['initialize', 'gk', 'sk']` before the progression call (keep the rest of that test as is).
5. Append:
```ts
describe('gameAnalyticsDriver theo lựa chọn quyền riêng tư', () => {
  const noWait = { readyPollMs: 1, readyTimeoutMs: 10, sleep: async () => {} };

  function storeSpy() {
    const removed: string[] = [];
    return { removed, store: { removeItem: (k: string) => void removed.push(k) } };
  }

  test('tạo driver khi đang tắt thì xóa kho SDK còn sót', () => {
    const s = storeSpy();
    createGameAnalyticsDriver(CONFIG, async () => fakeSdk().sdk, fakePrivacy({ analytics: false }), { ...noWait, store: s.store });
    expect(s.removed).toContain('GA::gk::ga_event');
  });

  test('rút lại sau khi SDK đã chạy: ngừng gửi, xóa kho, sự kiện sau bị bỏ', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy();
    const s = storeSpy();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, p, { ...noWait, store: s.store });
    await driver.track(START);
    p.change({ analytics: false }, 'user-2');
    await Promise.resolve();
    expect(calls).toContainEqual(['submission', false]);
    expect(s.removed).toContain('GA::gk::ga_event');
    const before = calls.length;
    await driver.track(START);
    expect(calls.length).toBe(before);
  });

  test('bật lại trong cùng phiên sau khi đã chạy thì vẫn dừng tới lần mở sau', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, p, noWait);
    await driver.track(START);
    p.change({ analytics: false }, 'user-2');
    p.change({ analytics: true });
    const before = calls.length;
    await driver.track(START);
    expect(calls.length).toBe(before);
  });

  test('bật lần đầu trong Settings (SDK chưa chạy) thì khởi tạo với userId hiện tại', async () => {
    const { sdk, calls } = fakeSdk();
    const p = fakePrivacy({ analytics: false });
    createGameAnalyticsDriver(CONFIG, async () => sdk, p, noWait);
    p.change({ analytics: true }, 'user-9');
    await vi.waitFor(() => expect(calls).toContainEqual(['initialize', 'gk', 'sk']));
    expect(calls).toContainEqual(['configureUserId', 'user-9']);
  });
});
```
Add `vi` to the vitest import at the top of the file.

Run: `npx vitest run tests/gameAnalyticsDriver.test.ts`
Expected: FAIL (type errors / new tests failing).

- [ ] **Step 5: Rewrite the driver**

Replace `src/infrastructure/gameAnalyticsDriver.ts` from the `GameAnalyticsLike` type to the end of the file with:

```ts
/** Phần của SDK mà game dùng; giữ hẹp để test thay bằng đồ giả. Bản thật bọc ở `gameAnalyticsSdk.ts`. */
export type GameAnalyticsLike = {
  configureBuild(build: string): void;
  /** Chỉ có tác dụng trước `initialize`. */
  configureUserId(userId: string): void;
  initialize(gameKey: string, secretKey: string): void;
  /** Phiên đã mở. SDK bỏ hẳn (không xếp hàng) mọi sự kiện gửi trước thời điểm này. */
  isReady(): boolean;
  setEnabledEventSubmission(flag: boolean): void;
  addProgressionEvent(
    status: ProgressionStatus,
    progression01: string,
    progression02?: string,
    progression03?: string,
    score?: number
  ): void;
  addDesignEvent(eventId: string, value?: number): void;
};

export type AnalyticsPrivacy = Pick<PrivacyChoices, 'get' | 'userId' | 'onChange'>;

export type GameAnalyticsOptions = {
  /** Chu kỳ hỏi `isReady` sau khi khởi tạo. */
  readyPollMs?: number;
  /** Quá hạn này mà SDK vẫn chưa sẵn sàng thì bỏ cuộc: mọi sự kiện thành no-op. */
  readyTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Nơi SDK lưu sự kiện chưa gửi; mặc định localStorage. */
  store?: Pick<Storage, 'removeItem'> | null;
};

export type GameAnalyticsDriver = AnalyticsDriver & {
  /** Khởi tạo SDK ngay (nếu đã đồng ý) để phiên đã mở trước khi sự kiện đầu tiên xuất hiện. */
  warmUp(): void;
};

type SdkCall = (ga: GameAnalyticsLike) => void;

/** Mỗi đoạn của eventId tối đa 32 ký tự (giới hạn của GameAnalytics). */
function segment(text: string): string {
  return text.slice(0, 32);
}

function callsFor(event: TelemetryEvent): SdkCall[] {
  switch (event.type) {
    case 'level_start':
      return [(ga) => ga.addProgressionEvent('Start', `chapter${event.chapter}`, event.levelId)];
    case 'level_complete':
      return [
        (ga) => ga.addProgressionEvent('Complete', `chapter${event.chapter}`, event.levelId, undefined, event.stars),
        (ga) => ga.addDesignEvent(`Complete:Moves:${segment(event.levelId)}`, event.moveCount),
        (ga) => ga.addDesignEvent(`Complete:Resets:${segment(event.levelId)}`, event.resetCount),
      ];
    case 'level_abandon':
      return [
        (ga) => ga.addProgressionEvent('Fail', `chapter${event.chapter}`, event.levelId),
        (ga) => ga.addDesignEvent(`Abandon:${segment(event.levelId)}`, event.resetCount),
      ];
    default:
      return [];
  }
}

/**
 * Theo `PrivacyChoices`: chưa đồng ý thì không nạp, không khởi tạo SDK. Đồng ý thì nạp ở nền và gắn userId của
 * game trước `initialize`. Rút lại thì ngừng gửi và xóa kho sự kiện chưa gửi. SDK không đổi được userId khi đang
 * chạy, nên bật lại trong cùng phiên chỉ có hiệu lực từ lần mở app sau.
 */
export function createGameAnalyticsDriver(
  config: GameAnalyticsConfig,
  load: () => Promise<GameAnalyticsLike>,
  privacy: AnalyticsPrivacy,
  options: GameAnalyticsOptions = {}
): GameAnalyticsDriver {
  const {
    readyPollMs = 200,
    readyTimeoutMs = 10_000,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    store = getSafeStorage(),
  } = options;

  const waitUntilReady = async (ga: GameAnalyticsLike): Promise<boolean> => {
    for (let waited = 0; waited <= readyTimeoutMs; waited += readyPollMs) {
      if (ga.isReady()) return true;
      await sleep(readyPollMs);
    }
    return false;
  };

  let ready: Promise<GameAnalyticsLike | null> | null = null;
  /** Đã rút lại sau khi SDK chạy: dừng hẳn tới lần mở sau. */
  let stopped = false;

  const sdk = (): Promise<GameAnalyticsLike | null> =>
    (ready ??= initInBackground(
      'gameanalytics',
      async () => {
        const ga = await load();
        ga.configureBuild(config.build);
        ga.configureUserId(privacy.userId());
        ga.initialize(config.gameKey, config.secretKey);
        return (await waitUntilReady(ga)) ? ga : null;
      },
      readyTimeoutMs + 5000
    ));

  const active = (): boolean => privacy.get().analytics && !stopped;

  if (!privacy.get().analytics) clearGameAnalyticsStore(store, config.gameKey);

  privacy.onChange((state) => {
    if (!state.analytics) {
      if (ready) {
        stopped = true;
        void ready.then((ga) => {
          try {
            ga?.setEnabledEventSubmission(false);
          } catch {
            // SDK hỏng: đằng nào cũng không gửi nữa.
          }
        });
      }
      clearGameAnalyticsStore(store, config.gameKey);
      return;
    }
    if (!ready && !stopped) void sdk();
  });

  return {
    warmUp() {
      if (active()) void sdk();
    },
    track(event) {
      if (!active()) return;
      const calls = callsFor(event);
      if (calls.length === 0) return;
      return sdk().then((ga) => {
        if (!ga || !active()) return;
        for (const call of calls) {
          try {
            call(ga);
          } catch {
            // Một lệnh hỏng không chặn các lệnh sau.
          }
        }
      });
    },
  };
}
```

Replace the file's imports with:

```ts
import type { TelemetryEvent } from '../engine/core/platform/telemetry.ts';
import { initInBackground } from '../engine/core/platform/platformServices.ts';
import type { AnalyticsDriver } from '../engine/core/platform/platformServices.ts';
import { getSafeStorage } from '../engine/core/platform/safeStorage.ts';
import type { PrivacyChoices } from '../application/privacyChoices.ts';
import { clearGameAnalyticsStore } from './gameAnalyticsStore.ts';
```
Keep `GameAnalyticsConfig` and `ProgressionStatus` exports as they are.

- [ ] **Step 6: Expose the two SDK calls**

In `src/infrastructure/gameAnalyticsSdk.ts`, add to `GameAnalyticsModule.GameAnalytics`:
```ts
    configureUserId(userId: string): void;
    setEnabledEventSubmission(flag: boolean): void;
```
and to the returned object in `loadGameAnalytics`:
```ts
    configureUserId: (userId) => GameAnalytics.configureUserId(userId),
    setEnabledEventSubmission: (flag) => GameAnalytics.setEnabledEventSubmission(flag),
```

- [ ] **Step 7: Pass privacy through `analyticsSetup.ts`**

Add `privacy: AnalyticsPrivacy;` to `AnalyticsSelectionInput` (import the type from `./gameAnalyticsDriver.ts`), destructure it, and create the driver with `createGameAnalyticsDriver({ gameKey, secretKey, build }, loadGameAnalytics, privacy)`. Update the doc comment: "GameAnalytics chỉ bật trong app native khi đủ hai key; khi đó mục Thống kê được đưa vào màn đồng ý."

In `tests/analyticsSetup.test.ts`, add at the top:
```ts
const PRIVACY = { get: () => ({ analytics: false, diagnostics: false }), userId: () => 'u', onChange: () => () => {} };
```
and add `privacy: PRIVACY` to every `selectAnalyticsDriver({...})` input. Change the three `toEqual({ driver: null, requiresConsent: false })` assertions to keep working (they do not include `privacy` in the output, so they still pass).

- [ ] **Step 8: Delete the old consent module**

```bash
git rm src/infrastructure/analyticsConsent.ts tests/analyticsConsent.test.ts
```
`consentGate.ts` still imports it; Task 5 rewrites that file. To keep this task green, replace the first line of `src/presentation/consent/consentGate.ts` with local stand-ins that Task 5 removes:
```ts
const isAnalyticsConsentGranted = (): boolean => false;
const grantAnalyticsConsent = (): void => {};
```

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run tests/gameAnalyticsDriver.test.ts tests/gameAnalyticsStore.test.ts tests/analyticsSetup.test.ts tests/consentGate.test.ts && npm run typecheck`
Expected: all PASS. `main.ts` will fail typecheck because `selectAnalyticsDriver` now needs `privacy`; add a temporary `privacy: createPrivacyChoices(getSafeStorage() ?? memoryStorage)` argument in `main.ts` (import from `./application/privacyChoices.ts`) — Task 7 restructures this wiring.

- [ ] **Step 10: Commit**

```bash
git add -A src/infrastructure src/presentation/consent/consentGate.ts src/main.ts tests/gameAnalyticsDriver.test.ts tests/gameAnalyticsStore.test.ts tests/analyticsSetup.test.ts
git commit -m "feat: drive GameAnalytics from PrivacyChoices and clear its store on withdrawal"
```

---

### Task 3: Sentry starts only with consent

**Files:**
- Modify: `src/engine/core/platform/sentryCrashDriver.ts`
- Test: `tests/sentryCrashDriver.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ConsentGate = { enabled(): boolean; onChange(listener: (enabled: boolean) => void): () => void };
  export const ALWAYS_ON: ConsentGate;
  export type SentryLike = { ...existing, close(): unknown };
  export function createSentryCrashDriver(config: SentryConfig, load?: () => Promise<SentryLike>, gate?: ConsentGate): CrashDriver;
  ```
  Default `gate` is `ALWAYS_ON`, so existing callers and tests behave as before.

- [ ] **Step 1: Write the failing tests**

In `tests/sentryCrashDriver.test.ts`, add `close: () => void log.push('close'),` to the `sentry` object in `fakeSentry()`, import `ConsentGate` as a type, and append:

```ts
function gate(initial: boolean) {
  let on = initial;
  const listeners = new Set<(v: boolean) => void>();
  const g: ConsentGate = {
    enabled: () => on,
    onChange: (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
  return {
    g,
    set(v: boolean) {
      on = v;
      for (const l of listeners) l(v);
    },
  };
}

describe('Sentry theo đồng ý báo lỗi', () => {
  test('chưa đồng ý: không init, mọi lệnh là no-op', async () => {
    const f = fakeSentry();
    const c = gate(false);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    await driver.capture(new Error('a'));
    await driver.breadcrumb?.('b');
    await driver.setContext?.('k', 1);
    expect(f.log).toEqual([]);
  });

  test('đồng ý thì init ngay (để có session) rồi gửi', async () => {
    const f = fakeSentry();
    const c = gate(false);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    c.set(true);
    await vi.waitFor(() => expect(f.log).toContain('init'));
    await driver.capture(new Error('x'));
    expect(f.log.filter((l) => l.startsWith('capture'))).toHaveLength(1);
  });

  test('rút lại thì close và lệnh sau là no-op; bật lại thì init lần nữa', async () => {
    const f = fakeSentry();
    const c = gate(true);
    const driver = createSentryCrashDriver(CONFIG, async () => f.sentry, c.g);
    await driver.capture(new Error('one'));
    c.set(false);
    await vi.waitFor(() => expect(f.log).toContain('close'));
    await driver.capture(new Error('two'));
    expect(f.log.some((l) => l.startsWith('capture:two'))).toBe(false);
    c.set(true);
    await vi.waitFor(() => expect(f.log.filter((l) => l === 'init')).toHaveLength(2));
  });
});
```

Run: `npx vitest run tests/sentryCrashDriver.test.ts`
Expected: FAIL (third argument not supported, `close` missing).

- [ ] **Step 2: Implement**

In `src/engine/core/platform/sentryCrashDriver.ts`:

1. Add `close(timeout?: number): unknown;` to `SentryLike`.
2. Add after the `SentryLike` type:
```ts
/** Đồng ý báo lỗi do game quyết định; engine chỉ cần biết bật hay tắt và khi nào đổi. */
export type ConsentGate = { enabled(): boolean; onChange(listener: (enabled: boolean) => void): () => void };

export const ALWAYS_ON: ConsentGate = { enabled: () => true, onChange: () => () => {} };
```
3. Replace the body of `createSentryCrashDriver` (signature gains `gate: ConsentGate = ALWAYS_ON` as third parameter) with:
```ts
  let ready: Promise<SentryLike | null> | null = null;

  const start = (): Promise<SentryLike | null> =>
    (ready ??= initInBackground('sentry', async () => {
      const sentry = await load();
      sentry.init({
        dsn: config.dsn,
        release: config.release,
        environment: config.environment,
        sendDefaultPii: false,
        maxBreadcrumbs: MAX_BREADCRUMBS,
        ignoreErrors: IGNORED_ERRORS,
        denyUrls: DENIED_URLS,
        beforeBreadcrumb: (crumb: Crumb) => (keepBreadcrumb(crumb) ? crumb : null),
        beforeSend: (event: SentryEventLike) => (isFromApp(event, config.appOrigin) ? event : null),
        ...(config.tags ? { initialScope: { tags: config.tags } } : {}),
        // Lỗi toàn cục đã đi qua `installGlobalErrorHandlers`; tắt cái của Sentry để không báo hai lần.
        integrations: (defaults: { name: string }[]) => defaults.filter((i) => i.name !== 'GlobalHandlers'),
      });
      return sentry;
    }));

  /** Chỉ chạy lệnh khi đang được đồng ý; đang tắt thì bỏ, không xếp hàng. */
  const whenOn = (run: (sentry: SentryLike) => void): Promise<void> | undefined =>
    gate.enabled() ? start().then((sentry) => void (sentry && gate.enabled() && run(sentry))) : undefined;

  if (gate.enabled()) void start();
  gate.onChange((on) => {
    if (on) {
      void start();
      return;
    }
    const closing = ready;
    ready = null;
    void closing?.then((sentry) => {
      try {
        void sentry?.close();
      } catch {
        // đóng hỏng: lệnh sau vẫn là no-op vì gate đã tắt
      }
    });
  });

  return {
    capture: (error, context) =>
      whenOn((sentry) =>
        void sentry.captureException(error, {
          ...(context ? { extra: { ...context } } : {}),
          // Lỗi toàn cục là lỗi không ai bắt: để Sentry gắn nhãn "Unhandled" đúng như khi dùng handler của nó.
          ...(context?.source === 'window.onerror' || context?.source === 'unhandledrejection'
            ? { mechanism: { handled: false, type: `game.${String(context.source)}` } }
            : {}),
        })
      ),
    breadcrumb: (message) => whenOn((sentry) => void sentry.addBreadcrumb({ message, category: 'game' })),
    setContext: (key, value) => whenOn((sentry) => void sentry.setTag(key, String(value))),
  };
```
Note the existing init options block moves inside `start()` unchanged; delete the old `const ready = initInBackground(...)` block.

4. Update the doc comment above the function: add "Có `gate` thì chỉ khởi tạo khi được đồng ý; rút lại thì `close()` và mọi lệnh sau là no-op; bật lại thì khởi tạo lần nữa."

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/sentryCrashDriver.test.ts tests/engine`
Expected: PASS, including the existing tests (default gate `ALWAYS_ON`) and `engineBoundary`.

Note: the existing test `'lệnh gọi trước khi Sentry tải xong chạy sau, đúng thứ tự'` expects `['init', 'tag:locale=vi', 'crumb:drop:game', 'capture:...']`. Calls are chained on the same `start()` promise, so order is preserved; if it fails because `init` now runs at construction, the expectation still holds since `init` is logged first.

- [ ] **Step 4: Commit**

```bash
git add src/engine/core/platform/sentryCrashDriver.ts tests/sentryCrashDriver.test.ts
git commit -m "feat: start Sentry only with diagnostics consent and close it on withdrawal"
```

---

### Task 4: Localisation keys

**Files:**
- Modify: `src/localization/types.ts` (the `CommonTranslationKey` union), `src/locales/<each of 10>/common.json`
- Test: existing `tests/localizationCoverage.test.ts`

**Interfaces:**
- Produces these `CommonTranslationKey` members: `privacy_title`, `privacy_intro`, `privacy_accept_all`, `privacy_reject_all`, `privacy_options`, `privacy_save`, `privacy_analytics`, `privacy_analytics_desc`, `privacy_diagnostics`, `privacy_diagnostics_desc`, `privacy_ads`, `privacy_your_id`, `privacy_copy`, `privacy_copied`, `privacy_policy`, `setting_privacy_row`.

`setting_privacy` (the old UMP row label) is removed from all locales and the union; the UMP row inside `PrivacyDialog` uses `privacy_ads`, and the Settings row uses `setting_privacy_row`. No dead key remains.

- [ ] **Step 1: Add the union members** in `src/localization/types.ts` (replace `| 'setting_privacy'` with):
```ts
  | 'setting_privacy_row'
  | 'privacy_title'
  | 'privacy_intro'
  | 'privacy_accept_all'
  | 'privacy_reject_all'
  | 'privacy_options'
  | 'privacy_save'
  | 'privacy_analytics'
  | 'privacy_analytics_desc'
  | 'privacy_diagnostics'
  | 'privacy_diagnostics_desc'
  | 'privacy_ads'
  | 'privacy_your_id'
  | 'privacy_copy'
  | 'privacy_copied'
  | 'privacy_policy'
```

- [ ] **Step 2: Replace `"setting_privacy": ...` in each `common.json`** with the block for that locale.

en-US:
```json
  "setting_privacy_row": "Privacy",
  "privacy_title": "Your privacy",
  "privacy_intro": "Nozvi works fully without sharing anything. You can help us improve it by sharing anonymous gameplay statistics and error reports. Change this any time in Settings.",
  "privacy_accept_all": "Accept all",
  "privacy_reject_all": "Reject all",
  "privacy_options": "Options",
  "privacy_save": "Save choices",
  "privacy_analytics": "Gameplay statistics",
  "privacy_analytics_desc": "Levels played, stars, moves and device type, sent to GameAnalytics.",
  "privacy_diagnostics": "Error reports",
  "privacy_diagnostics_desc": "What went wrong when the game fails, sent to Sentry.",
  "privacy_ads": "Ad choices",
  "privacy_your_id": "Your ID",
  "privacy_copy": "Copy",
  "privacy_copied": "Copied",
  "privacy_policy": "Privacy Policy",
```
vi:
```json
  "setting_privacy_row": "Quyền riêng tư",
  "privacy_title": "Quyền riêng tư của bạn",
  "privacy_intro": "Nozvi chơi đầy đủ mà không cần chia sẻ gì. Bạn có thể giúp cải thiện game bằng cách chia sẻ thống kê chơi ẩn danh và báo lỗi. Đổi lựa chọn bất cứ lúc nào trong Cài đặt.",
  "privacy_accept_all": "Đồng ý tất cả",
  "privacy_reject_all": "Từ chối tất cả",
  "privacy_options": "Tùy chọn",
  "privacy_save": "Lưu lựa chọn",
  "privacy_analytics": "Thống kê cách chơi",
  "privacy_analytics_desc": "Màn đã chơi, số sao, số lần di chuyển và loại máy, gửi tới GameAnalytics.",
  "privacy_diagnostics": "Báo lỗi",
  "privacy_diagnostics_desc": "Thông tin lỗi khi game gặp sự cố, gửi tới Sentry.",
  "privacy_ads": "Lựa chọn quảng cáo",
  "privacy_your_id": "Mã của bạn",
  "privacy_copy": "Sao chép",
  "privacy_copied": "Đã sao chép",
  "privacy_policy": "Chính sách quyền riêng tư",
```
es:
```json
  "setting_privacy_row": "Privacidad",
  "privacy_title": "Tu privacidad",
  "privacy_intro": "Nozvi funciona por completo sin compartir nada. Puedes ayudarnos a mejorarlo compartiendo estadísticas de juego anónimas e informes de errores. Cámbialo cuando quieras en Ajustes.",
  "privacy_accept_all": "Aceptar todo",
  "privacy_reject_all": "Rechazar todo",
  "privacy_options": "Opciones",
  "privacy_save": "Guardar opciones",
  "privacy_analytics": "Estadísticas de juego",
  "privacy_analytics_desc": "Niveles jugados, estrellas, movimientos y tipo de dispositivo, enviados a GameAnalytics.",
  "privacy_diagnostics": "Informes de errores",
  "privacy_diagnostics_desc": "Qué falló cuando el juego tiene un error, enviado a Sentry.",
  "privacy_ads": "Opciones de anuncios",
  "privacy_your_id": "Tu ID",
  "privacy_copy": "Copiar",
  "privacy_copied": "Copiado",
  "privacy_policy": "Política de privacidad",
```
pt-BR:
```json
  "setting_privacy_row": "Privacidade",
  "privacy_title": "Sua privacidade",
  "privacy_intro": "O Nozvi funciona por completo sem compartilhar nada. Você pode nos ajudar a melhorá-lo compartilhando estatísticas de jogo anônimas e relatórios de erros. Mude isso quando quiser em Configurações.",
  "privacy_accept_all": "Aceitar tudo",
  "privacy_reject_all": "Recusar tudo",
  "privacy_options": "Opções",
  "privacy_save": "Salvar escolhas",
  "privacy_analytics": "Estatísticas de jogo",
  "privacy_analytics_desc": "Fases jogadas, estrelas, movimentos e tipo de aparelho, enviados ao GameAnalytics.",
  "privacy_diagnostics": "Relatórios de erros",
  "privacy_diagnostics_desc": "O que deu errado quando o jogo falha, enviado ao Sentry.",
  "privacy_ads": "Escolhas de anúncios",
  "privacy_your_id": "Seu ID",
  "privacy_copy": "Copiar",
  "privacy_copied": "Copiado",
  "privacy_policy": "Política de Privacidade",
```
fr:
```json
  "setting_privacy_row": "Confidentialité",
  "privacy_title": "Votre confidentialité",
  "privacy_intro": "Nozvi fonctionne entièrement sans rien partager. Vous pouvez nous aider à l'améliorer en partageant des statistiques de jeu anonymes et des rapports d'erreurs. Modifiable à tout moment dans les Paramètres.",
  "privacy_accept_all": "Tout accepter",
  "privacy_reject_all": "Tout refuser",
  "privacy_options": "Options",
  "privacy_save": "Enregistrer",
  "privacy_analytics": "Statistiques de jeu",
  "privacy_analytics_desc": "Niveaux joués, étoiles, coups et type d'appareil, envoyés à GameAnalytics.",
  "privacy_diagnostics": "Rapports d'erreurs",
  "privacy_diagnostics_desc": "Ce qui s'est mal passé quand le jeu plante, envoyé à Sentry.",
  "privacy_ads": "Choix publicitaires",
  "privacy_your_id": "Votre identifiant",
  "privacy_copy": "Copier",
  "privacy_copied": "Copié",
  "privacy_policy": "Politique de confidentialité",
```
de:
```json
  "setting_privacy_row": "Datenschutz",
  "privacy_title": "Deine Privatsphäre",
  "privacy_intro": "Nozvi funktioniert vollständig, ohne etwas zu teilen. Du kannst uns helfen, indem du anonyme Spielstatistiken und Fehlerberichte teilst. Jederzeit in den Einstellungen änderbar.",
  "privacy_accept_all": "Alle akzeptieren",
  "privacy_reject_all": "Alle ablehnen",
  "privacy_options": "Optionen",
  "privacy_save": "Auswahl speichern",
  "privacy_analytics": "Spielstatistiken",
  "privacy_analytics_desc": "Gespielte Level, Sterne, Züge und Gerätetyp, gesendet an GameAnalytics.",
  "privacy_diagnostics": "Fehlerberichte",
  "privacy_diagnostics_desc": "Was bei einem Absturz schiefging, gesendet an Sentry.",
  "privacy_ads": "Werbeeinstellungen",
  "privacy_your_id": "Deine ID",
  "privacy_copy": "Kopieren",
  "privacy_copied": "Kopiert",
  "privacy_policy": "Datenschutzerklärung",
```
ja:
```json
  "setting_privacy_row": "プライバシー",
  "privacy_title": "プライバシーについて",
  "privacy_intro": "Nozviは何も共有しなくてもすべて遊べます。匿名のプレイ統計とエラーレポートを共有して改善にご協力いただけます。設定でいつでも変更できます。",
  "privacy_accept_all": "すべて同意",
  "privacy_reject_all": "すべて拒否",
  "privacy_options": "オプション",
  "privacy_save": "選択を保存",
  "privacy_analytics": "プレイ統計",
  "privacy_analytics_desc": "プレイしたステージ、星、手数、端末の種類をGameAnalyticsに送信します。",
  "privacy_diagnostics": "エラーレポート",
  "privacy_diagnostics_desc": "ゲームに問題が起きたときの内容をSentryに送信します。",
  "privacy_ads": "広告の設定",
  "privacy_your_id": "あなたのID",
  "privacy_copy": "コピー",
  "privacy_copied": "コピーしました",
  "privacy_policy": "プライバシーポリシー",
```
ko:
```json
  "setting_privacy_row": "개인정보",
  "privacy_title": "개인정보 보호",
  "privacy_intro": "Nozvi는 아무것도 공유하지 않아도 모두 즐길 수 있습니다. 익명 플레이 통계와 오류 보고서를 공유해 개선을 도와주세요. 설정에서 언제든 바꿀 수 있습니다.",
  "privacy_accept_all": "모두 동의",
  "privacy_reject_all": "모두 거부",
  "privacy_options": "옵션",
  "privacy_save": "선택 저장",
  "privacy_analytics": "플레이 통계",
  "privacy_analytics_desc": "플레이한 스테이지, 별, 이동 횟수, 기기 종류를 GameAnalytics로 보냅니다.",
  "privacy_diagnostics": "오류 보고서",
  "privacy_diagnostics_desc": "게임에 문제가 생겼을 때의 내용을 Sentry로 보냅니다.",
  "privacy_ads": "광고 선택",
  "privacy_your_id": "내 ID",
  "privacy_copy": "복사",
  "privacy_copied": "복사됨",
  "privacy_policy": "개인정보처리방침",
```
zh-CN:
```json
  "setting_privacy_row": "隐私",
  "privacy_title": "你的隐私",
  "privacy_intro": "不分享任何数据也能完整游玩 Nozvi。你可以分享匿名游戏统计和错误报告，帮助我们改进游戏。可随时在设置中更改。",
  "privacy_accept_all": "全部同意",
  "privacy_reject_all": "全部拒绝",
  "privacy_options": "选项",
  "privacy_save": "保存选择",
  "privacy_analytics": "游戏统计",
  "privacy_analytics_desc": "玩过的关卡、星级、步数和设备类型，发送至 GameAnalytics。",
  "privacy_diagnostics": "错误报告",
  "privacy_diagnostics_desc": "游戏出错时的问题信息，发送至 Sentry。",
  "privacy_ads": "广告选项",
  "privacy_your_id": "你的 ID",
  "privacy_copy": "复制",
  "privacy_copied": "已复制",
  "privacy_policy": "隐私政策",
```
id:
```json
  "setting_privacy_row": "Privasi",
  "privacy_title": "Privasi Anda",
  "privacy_intro": "Nozvi dapat dimainkan sepenuhnya tanpa membagikan apa pun. Anda bisa membantu kami dengan membagikan statistik permainan anonim dan laporan kesalahan. Ubah kapan saja di Pengaturan.",
  "privacy_accept_all": "Terima semua",
  "privacy_reject_all": "Tolak semua",
  "privacy_options": "Opsi",
  "privacy_save": "Simpan pilihan",
  "privacy_analytics": "Statistik permainan",
  "privacy_analytics_desc": "Level yang dimainkan, bintang, langkah, dan jenis perangkat, dikirim ke GameAnalytics.",
  "privacy_diagnostics": "Laporan kesalahan",
  "privacy_diagnostics_desc": "Apa yang salah saat game bermasalah, dikirim ke Sentry.",
  "privacy_ads": "Pilihan iklan",
  "privacy_your_id": "ID Anda",
  "privacy_copy": "Salin",
  "privacy_copied": "Tersalin",
  "privacy_policy": "Kebijakan Privasi",
```

- [ ] **Step 3: Run coverage and typecheck**

Run: `npx vitest run tests/localizationCoverage.test.ts && npm run typecheck`
Expected: coverage PASS; typecheck FAILS only at `SettingsDialog.ts` (`setting_privacy`) and `tests/dialogsInput.test.ts`. Change both usages to `setting_privacy_row` temporarily so typecheck passes; Task 6 replaces the row.

- [ ] **Step 4: Commit**

```bash
git add src/localization/types.ts src/locales src/presentation/dialogs/SettingsDialog.ts tests/dialogsInput.test.ts
git commit -m "feat: add privacy consent strings in all ten locales"
```

---

### Task 5: First-launch consent screen

**Files:**
- Create: `src/presentation/consent/consentModel.ts`
- Rewrite: `src/presentation/consent/consentGate.ts`
- Test: `tests/consentModel.test.ts` (new), `tests/consentGate.test.ts` (rewrite)

**Interfaces:**
- Consumes: `PrivacyPurpose`, `PrivacyState` (Task 1); `t` from `src/presentation/i18n.ts`; keys from Task 4.
- Produces:
  ```ts
  // consentModel.ts
  export type ConsentAction = 'accept_all' | 'reject_all' | 'save';
  export function choicesFor(action: ConsentAction, offered: readonly PrivacyPurpose[], switches: Partial<PrivacyState>): PrivacyState;
  // consentGate.ts
  export type ConsentGateOptions = {
    offered: readonly PrivacyPurpose[];
    policyUrl?: string;
    doc?: Document;
    translate?: (key: CommonTranslationKey) => string;
  };
  export function requestPrivacyChoices(options: ConsentGateOptions): Promise<PrivacyState>;
  ```

- [ ] **Step 1: Model test (failing)**

```ts
// tests/consentModel.test.ts
import { describe, expect, test } from 'vitest';
import { choicesFor } from '../src/presentation/consent/consentModel.ts';

describe('choicesFor', () => {
  test('đồng ý tất cả chỉ bật mục được đưa ra', () => {
    expect(choicesFor('accept_all', ['diagnostics'], {})).toEqual({ analytics: false, diagnostics: true });
    expect(choicesFor('accept_all', ['analytics', 'diagnostics'], {})).toEqual({ analytics: true, diagnostics: true });
  });

  test('từ chối tất cả tắt hết, bỏ qua công tắc', () => {
    expect(choicesFor('reject_all', ['analytics', 'diagnostics'], { analytics: true })).toEqual({
      analytics: false,
      diagnostics: false,
    });
  });

  test('lưu lựa chọn theo công tắc, mục không đưa ra luôn tắt', () => {
    expect(choicesFor('save', ['analytics'], { analytics: true, diagnostics: true })).toEqual({
      analytics: true,
      diagnostics: false,
    });
  });
});
```

Run: `npx vitest run tests/consentModel.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement the model**

```ts
// src/presentation/consent/consentModel.ts
import type { PrivacyPurpose, PrivacyState } from '../../application/privacyChoices.ts';

export type ConsentAction = 'accept_all' | 'reject_all' | 'save';

/** Kết quả của màn đồng ý. Mục không có trong bản build này luôn tắt. */
export function choicesFor(
  action: ConsentAction,
  offered: readonly PrivacyPurpose[],
  switches: Partial<PrivacyState>
): PrivacyState {
  const pick = (purpose: PrivacyPurpose): boolean => {
    if (!offered.includes(purpose)) return false;
    if (action === 'accept_all') return true;
    if (action === 'reject_all') return false;
    return switches[purpose] === true;
  };
  return { analytics: pick('analytics'), diagnostics: pick('diagnostics') };
}
```

Run: `npx vitest run tests/consentModel.test.ts` → PASS.

- [ ] **Step 3: Gate test (failing)** — replace `tests/consentGate.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { requestPrivacyChoices } from '../src/presentation/consent/consentGate.ts';

type El = {
  tag: string;
  attrs: Record<string, string>;
  textContent: string;
  type?: string;
  checked?: boolean;
  hidden?: boolean;
  href?: string;
  children: El[];
  listeners: Record<string, () => void>;
  style: { cssText: string };
  removed: boolean;
};

function fakeDoc() {
  const all: El[] = [];
  const make = (tag: string): El => {
    const el: El = { tag, attrs: {}, textContent: '', children: [], listeners: {}, style: { cssText: '' }, removed: false };
    Object.assign(el, {
      setAttribute: (k: string, v: string) => void (el.attrs[k] = v),
      append: (...c: El[]) => void el.children.push(...c),
      appendChild: (c: El) => void el.children.push(c),
      addEventListener: (ev: string, fn: () => void) => void (el.listeners[ev] = fn),
      remove: () => void (el.removed = true),
    });
    all.push(el);
    return el;
  };
  const body = make('body');
  const doc = { createElement: make, body } as unknown as Document;
  const byId = (id: string) => all.find((e) => e.attrs['data-id'] === id)!;
  return { doc, all, byId, overlay: () => body.children[0] };
}

const T = (key: string) => key;

describe('requestPrivacyChoices', () => {
  test('từ chối tất cả: tắt hết và gỡ lớp phủ', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['analytics', 'diagnostics'], doc: d.doc, translate: T });
    d.byId('reject').listeners.click();
    await expect(done).resolves.toEqual({ analytics: false, diagnostics: false });
    expect(d.overlay().removed).toBe(true);
  });

  test('đồng ý tất cả trên web chỉ bật báo lỗi', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['diagnostics'], doc: d.doc, translate: T });
    d.byId('accept').listeners.click();
    await expect(done).resolves.toEqual({ analytics: false, diagnostics: true });
  });

  test('chỉ hiện công tắc cho mục được đưa ra; Tùy chọn mở phần công tắc; Lưu theo công tắc', async () => {
    const d = fakeDoc();
    const done = requestPrivacyChoices({ offered: ['analytics'], doc: d.doc, translate: T });
    expect(d.all.some((e) => e.attrs['data-id'] === 'switch-diagnostics')).toBe(false);
    const panel = d.byId('options-panel');
    expect(panel.hidden).toBe(true);
    d.byId('options').listeners.click();
    expect(panel.hidden).toBe(false);
    d.byId('switch-analytics').checked = true;
    d.byId('save').listeners.click();
    await expect(done).resolves.toEqual({ analytics: true, diagnostics: false });
  });

  test('hai nút nhanh có cùng kiểu chữ và kích thước', () => {
    const d = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], doc: d.doc, translate: T });
    expect(d.byId('accept').style.cssText).toBe(d.byId('reject').style.cssText);
  });

  test('có URL thì hiện link chính sách, không có thì ẩn', () => {
    const withUrl = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], policyUrl: 'https://x.test/p', doc: withUrl.doc, translate: T });
    expect(withUrl.byId('policy').href).toBe('https://x.test/p');
    const without = fakeDoc();
    void requestPrivacyChoices({ offered: ['diagnostics'], doc: without.doc, translate: T });
    expect(without.all.some((e) => e.attrs['data-id'] === 'policy')).toBe(false);
  });
});
```

Run: `npx vitest run tests/consentGate.test.ts` → FAIL.

- [ ] **Step 4: Rewrite the gate**

```ts
// src/presentation/consent/consentGate.ts
import type { PrivacyPurpose, PrivacyState } from '../../application/privacyChoices.ts';
import type { CommonTranslationKey } from '../../localization/types.ts';
import { t } from '../i18n.ts';
import { choicesFor } from './consentModel.ts';
import type { ConsentAction } from './consentModel.ts';

export type ConsentGateOptions = {
  offered: readonly PrivacyPurpose[];
  policyUrl?: string;
  doc?: Document;
  translate?: (key: CommonTranslationKey) => string;
};

const BUTTON_CSS =
  'flex:1;min-width:140px;min-height:52px;border-radius:26px;font-size:17px;font-weight:700;' +
  'border:2px solid #7FD8FF;background:#273677;color:#FFFFFF;';

const LABELS: Record<PrivacyPurpose, [CommonTranslationKey, CommonTranslationKey]> = {
  analytics: ['privacy_analytics', 'privacy_analytics_desc'],
  diagnostics: ['privacy_diagnostics', 'privacy_diagnostics_desc'],
};

/**
 * Lớp phủ DOM lúc khởi động, trước khi Phaser chạy. "Từ chối tất cả" và "Đồng ý tất cả" ngang hàng;
 * "Tùy chọn" mở công tắc từng mục. Lựa chọn nào cũng cho vào game.
 */
export function requestPrivacyChoices(options: ConsentGateOptions): Promise<PrivacyState> {
  const doc = options.doc ?? document;
  const tr = options.translate ?? t;
  const { offered } = options;

  return new Promise((resolve) => {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string): HTMLElementTagNameMap[K] => {
      const node = doc.createElement(tag);
      if (id) node.setAttribute('data-id', id);
      return node;
    };

    const overlay = el('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:20px;padding:32px;background:#1A2470;color:#fff;text-align:center;' +
      "font-family:'Be Vietnam Pro',sans-serif;overflow-y:auto;";

    const title = el('h1');
    title.textContent = tr('privacy_title');
    title.style.cssText = 'margin:0;font-size:24px;color:#FFD23F;';

    const intro = el('p');
    intro.textContent = tr('privacy_intro');
    intro.style.cssText = 'max-width:440px;margin:0;font-size:16px;line-height:1.5;';

    overlay.append(title, intro);

    if (options.policyUrl) {
      const policy = el('a', 'policy');
      policy.href = options.policyUrl;
      policy.setAttribute('target', '_blank');
      policy.setAttribute('rel', 'noopener');
      policy.textContent = tr('privacy_policy');
      policy.style.cssText = 'color:#7FD8FF;font-size:15px;';
      overlay.append(policy);
    }

    const finish = (action: ConsentAction, switches: Partial<PrivacyState> = {}): void => {
      overlay.remove();
      resolve(choicesFor(action, offered, switches));
    };

    const row = el('div');
    row.style.cssText = 'display:flex;gap:12px;width:100%;max-width:440px;';
    const reject = el('button', 'reject');
    reject.type = 'button';
    reject.textContent = tr('privacy_reject_all');
    reject.style.cssText = BUTTON_CSS;
    reject.addEventListener('click', () => finish('reject_all'));
    const accept = el('button', 'accept');
    accept.type = 'button';
    accept.textContent = tr('privacy_accept_all');
    accept.style.cssText = BUTTON_CSS;
    accept.addEventListener('click', () => finish('accept_all'));
    row.append(reject, accept);

    const panel = el('div', 'options-panel');
    panel.hidden = true;
    panel.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%;max-width:440px;text-align:left;';
    const switches: Partial<Record<PrivacyPurpose, HTMLInputElement>> = {};
    for (const purpose of offered) {
      const [labelKey, descKey] = LABELS[purpose];
      const label = el('label');
      label.style.cssText = 'display:flex;gap:12px;align-items:flex-start;font-size:16px;';
      const input = el('input', `switch-${purpose}`);
      input.type = 'checkbox';
      input.checked = false;
      input.style.cssText = 'width:24px;height:24px;flex:none;';
      const text = el('span');
      text.textContent = `${tr(labelKey)}: ${tr(descKey)}`;
      label.append(input, text);
      panel.append(label);
      switches[purpose] = input;
    }
    const save = el('button', 'save');
    save.type = 'button';
    save.textContent = tr('privacy_save');
    save.style.cssText = BUTTON_CSS;
    save.addEventListener('click', () =>
      finish('save', {
        analytics: switches.analytics?.checked === true,
        diagnostics: switches.diagnostics?.checked === true,
      })
    );
    panel.append(save);

    const optionsToggle = el('button', 'options');
    optionsToggle.type = 'button';
    optionsToggle.textContent = `${tr('privacy_options')} ▾`;
    optionsToggle.style.cssText = 'background:none;border:0;color:#7FD8FF;font-size:16px;min-height:48px;';
    optionsToggle.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
    });

    overlay.append(row, optionsToggle, panel);
    doc.body.appendChild(overlay);
  });
}
```

Run: `npx vitest run tests/consentGate.test.ts tests/consentModel.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/presentation/consent tests/consentGate.test.ts tests/consentModel.test.ts
git commit -m "feat: first-launch privacy screen with reject all, accept all and per-service options"
```

---

### Task 6: `PrivacyDialog` and the Settings row

**Files:**
- Create: `src/presentation/privacyServices.ts`, `src/presentation/dialogs/PrivacyDialog.ts`
- Modify: `src/presentation/dialogs/SettingsDialog.ts` (lines 44-52 and 149-153), `tests/dialogsInput.test.ts` (block at lines 197-226 and the `setup` registry)
- Test: `tests/privacyDialog.test.ts` (new)

**Interfaces:**
- Consumes: `PrivacyChoices`, `PrivacyPurpose` (Task 1); `adsServices` (`src/presentation/adsServices.ts`); keys (Task 4).
- Produces:
  ```ts
  // privacyServices.ts
  export const PRIVACY_REGISTRY_KEY = 'privacy';
  export type PrivacyServices = {
    choices: Pick<PrivacyChoices, 'get' | 'set' | 'userId'> | null;
    offered: readonly PrivacyPurpose[];
    policyUrl?: string;
  };
  export const NO_PRIVACY: PrivacyServices; // { choices: null, offered: [] }
  export function privacyServices(scene: Phaser.Scene): PrivacyServices;
  export function shortId(id: string): string; // 'abcd…wxyz' (first 4 + '…' + last 4); ids ≤ 8 chars returned whole
  // PrivacyDialog.ts
  export class PrivacyDialog {
    constructor(scene: Phaser.Scene, onClose?: () => void);
    open(): void;
    close(): void;
    isOpen(): boolean;
  }
  ```

- [ ] **Step 1: Write failing tests**

Reuse the fake scene from `tests/dialogsInput.test.ts`: move its `setup` helper's item/proxy factory into `tests/helpers/fakeScene.ts` exporting `fakeScene(registry: Record<string, unknown>)` returning `{ scene, items, tap(x, y) }` with exactly the same body as today's `setup` (the `make` proxy, `scene` object and the `tap` function that already exists further down in that file), but with `registry: { get: (key: string) => registry[key] }`. Update `tests/dialogsInput.test.ts` to build its scene with `fakeScene({ ads })`.

```ts
// tests/privacyDialog.test.ts
import { describe, expect, it, vi } from 'vitest';
import { PrivacyDialog } from '../src/presentation/dialogs/PrivacyDialog.ts';
import { shortId } from '../src/presentation/privacyServices.ts';
import { NO_ADS } from '../src/presentation/adsServices.ts';
import { t } from '../src/presentation/i18n.ts';
import { fakeScene } from './helpers/fakeScene.ts';

function choices(initial = { analytics: false, diagnostics: false }) {
  let state = { ...initial };
  return {
    get: () => state,
    set: vi.fn((next: Partial<typeof state>) => void (state = { ...state, ...next })),
    userId: () => '0123456789abcdef',
  };
}

describe('shortId', () => {
  it('giữ 4 ký tự đầu và cuối', () => {
    expect(shortId('0123456789abcdef')).toBe('0123…cdef');
    expect(shortId('abc')).toBe('abc');
  });
});

describe('PrivacyDialog', () => {
  it('chỉ hiện công tắc cho mục được đưa ra', () => {
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(ui.scene).open();
    expect(ui.items.some((i) => i.text === t('privacy_diagnostics'))).toBe(true);
    expect(ui.items.some((i) => i.text === t('privacy_analytics'))).toBe(false);
  });

  it('bấm công tắc ghi vào PrivacyChoices', () => {
    const c = choices();
    const ui = fakeScene({ ads: NO_ADS, privacy: { choices: c, offered: ['analytics', 'diagnostics'] } });
    new PrivacyDialog(ui.scene).open();
    const row = ui.items.find((i) => i.text === t('privacy_analytics'))!;
    ui.tap(200, row.y);
    expect(c.set).toHaveBeenCalledWith({ analytics: true });
  });

  it('dòng quảng cáo chỉ hiện khi UMP yêu cầu và mở UMP', () => {
    const showPrivacyOptions = vi.fn(() => Promise.resolve());
    const hidden = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(hidden.scene).open();
    expect(hidden.items.some((i) => i.text === t('privacy_ads'))).toBe(false);

    const ui = fakeScene({
      ads: { ...NO_ADS, privacyOptionsRequired: () => true, showPrivacyOptions },
      privacy: { choices: choices(), offered: ['diagnostics'] },
    });
    new PrivacyDialog(ui.scene).open();
    const ads = ui.items.find((i) => i.text === t('privacy_ads'))!;
    ui.tap(-250, ads.y);
    expect(showPrivacyOptions).toHaveBeenCalledOnce();
  });

  it('hiện mã rút gọn khi có thống kê; không có thống kê thì không hiện mã', () => {
    const withGa = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['analytics'] } });
    new PrivacyDialog(withGa.scene).open();
    expect(withGa.items.some((i) => i.text?.includes('0123…cdef'))).toBe(true);
    const web = fakeScene({ ads: NO_ADS, privacy: { choices: choices(), offered: ['diagnostics'] } });
    new PrivacyDialog(web.scene).open();
    expect(web.items.some((i) => i.text?.includes('0123…cdef'))).toBe(false);
  });

  it('mọi vùng chạm đủ lớn', () => {
    const ui = fakeScene({
      ads: { ...NO_ADS, privacyOptionsRequired: () => true },
      privacy: { choices: choices(), offered: ['analytics', 'diagnostics'], policyUrl: 'https://x.test/p' },
    });
    new PrivacyDialog(ui.scene).open();
    for (const control of ui.items.filter((i) => i.interactive && i.kind !== 'rectangle')) {
      expect(control.width).toBeGreaterThanOrEqual(64);
      expect(control.height).toBeGreaterThanOrEqual(64);
    }
  });
});
```

Replace the `describe('Privacy settings row (EEA/UK consent)', ...)` block in `tests/dialogsInput.test.ts` with:

```ts
describe('Privacy row in Settings', () => {
  it('always shows, sits below the last toggle and opens the privacy dialog', () => {
    const ui = setup({ ...NO_ADS, privacyOptionsRequired: () => false });
    ui.settings.open();
    const haptics = ui.items.find(i => i.text === t('setting_haptics'))!;
    const privacy = ui.items.find(i => i.text === t('setting_privacy_row'))!;
    const danger = ui.items.find(i => i.text?.includes(t('setting_danger_reset')))!;
    expect(privacy.y - haptics.y).toBe(84);
    expect(danger.y - privacy.y).toBe(84);
    ui.tap(-250, privacy.y);
    expect(ui.items.some(i => i.text === t('privacy_title'))).toBe(true);
  });
});
```

Run: `npx vitest run tests/privacyDialog.test.ts tests/dialogsInput.test.ts` → FAIL.

- [ ] **Step 2: Implement `privacyServices.ts`**

```ts
// src/presentation/privacyServices.ts
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
```

- [ ] **Step 3: Implement `PrivacyDialog.ts`**

Build it the same way `SettingsDialog` builds its card (copy the backdrop, `createDialogPanelInput`, panel graphics, title and close-button code from `SettingsDialog.open()` lines 35-102, with `t('privacy_title')` as the title and `modalW = 620`). Rows start at `-modalH / 2 + 126` and step by 84. Use these private helpers, copied from `SettingsDialog` (`createLinkRow` lines 254-282 verbatim, and `createToggleRow` from line 287 verbatim), so rows look identical.

```ts
// src/presentation/dialogs/PrivacyDialog.ts — row logic inside open(), after the card is built
const privacy = privacyServices(this.scene);
const ads = adsServices(this.scene);
const choices = privacy.choices;
const rows: Array<(y: number) => void> = [];

if (choices && privacy.offered.includes('analytics')) {
  rows.push((y) =>
    this.createToggleRow(y, t('privacy_analytics'), choices.get().analytics, (on) => choices.set({ analytics: on }))
  );
}
if (choices && privacy.offered.includes('diagnostics')) {
  rows.push((y) =>
    this.createToggleRow(y, t('privacy_diagnostics'), choices.get().diagnostics, (on) => choices.set({ diagnostics: on }))
  );
}
if (ads.privacyOptionsRequired()) {
  rows.push((y) => this.createLinkRow(y, t('privacy_ads'), () => void ads.showPrivacyOptions()));
}
if (choices && privacy.offered.includes('analytics')) {
  rows.push((y) =>
    this.createLinkRow(y, `${t('privacy_your_id')}: ${shortId(choices.userId())}  ·  ${t('privacy_copy')}`, () => {
      void navigator.clipboard?.writeText(choices.userId()).catch(() => {});
    })
  );
}
if (privacy.policyUrl) {
  const url = privacy.policyUrl;
  rows.push((y) => this.createLinkRow(y, t('privacy_policy'), () => void window.open(url, '_blank', 'noopener')));
}
```

`modalH` is computed before building the card as `126 + rows.length * 84 + 60` (title band + rows + bottom margin), so the card fits the rows present. After the card, run `rows.forEach((draw, i) => draw(-modalH / 2 + 126 + i * 84))`. `close()` destroys the container and calls `onClose`; `isOpen()` returns `!!this.container`. Depth `160` so it sits above Settings (`150`).

- [ ] **Step 4: Replace the Settings row**

In `SettingsDialog.open()`:
- Delete `const ads = adsServices(this.scene);` and `const showPrivacy = ads.privacyOptionsRequired();` and set `const lastRowOffset = privacyOffset;` (the row is always present).
- Replace the `if (showPrivacy) { ... }` block with:
```ts
    this.createLinkRow(-modalH / 2 + privacyOffset, t('setting_privacy_row'), () => {
      new PrivacyDialog(this.scene).open();
    });
```
- Add `import { PrivacyDialog } from './PrivacyDialog.ts';` and remove the `adsServices` import if it is now unused.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/privacyDialog.test.ts tests/dialogsInput.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/presentation/privacyServices.ts src/presentation/dialogs tests/privacyDialog.test.ts tests/dialogsInput.test.ts tests/helpers/fakeScene.ts
git commit -m "feat: privacy dialog in Settings with per-service switches, ad choices, user ID and policy link"
```

---

### Task 7: Wire it up in `main.ts`, docs, full verification

**Files:**
- Modify: `src/main.ts` (lines 47-74 and 160-166, plus the registry block after `game.registry.set(ADS_REGISTRY_KEY, ...)`), `src/vite-env.d.ts`, `STATUS.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Declare the env var** in `src/vite-env.d.ts` inside `ImportMetaEnv`:
```ts
  /** Public URL of the Privacy Policy; the consent screen and Privacy dialog link to it. Hidden when unset. */
  readonly VITE_PRIVACY_POLICY_URL?: string;
```

- [ ] **Step 2: Wire `main.ts`**

Replace the Task 2 temporary `privacy` argument and the platform setup with:

```ts
const privacy = createPrivacyChoices(getSafeStorage() ?? memoryStorage);
const policyUrl = import.meta.env.VITE_PRIVACY_POLICY_URL || undefined;
// Dev server không gửi lỗi lên Sentry (tránh nhiễu và tốn quota), trừ khi đặt VITE_SENTRY_DEV=true để thử.
const sentryDsn =
  !import.meta.env.DEV || import.meta.env.VITE_SENTRY_DEV === 'true' ? import.meta.env.VITE_SENTRY_DSN : undefined;
const analyticsSelection = selectAnalyticsDriver({
  gameKey: import.meta.env.VITE_GA_GAME_KEY,
  secretKey: import.meta.env.VITE_GA_SECRET_KEY,
  isNative: Capacitor.isNativePlatform(),
  isDev: import.meta.env.DEV,
  build: APP_VERSION,
  privacy,
});
/** Mục có trong bản build này; màn đồng ý và dialog Privacy chỉ hiện những mục này. */
const offeredPurposes: PrivacyPurpose[] = [
  ...(analyticsSelection.requiresConsent ? (['analytics'] as const) : []),
  ...(sentryDsn ? (['diagnostics'] as const) : []),
];
const diagnosticsGate: ConsentGate = {
  enabled: () => privacy.get().diagnostics,
  onChange: (listener) => privacy.onChange((state) => listener(state.diagnostics)),
};
const platform = createPlatformServices({
  ads: adMobConfig ? createAdMobDriver(AdMob, adMobConfig) : null,
  crash: sentryDsn
    ? createSentryCrashDriver(
        {
          dsn: sentryDsn,
          release: APP_VERSION,
          environment: import.meta.env.MODE,
          appOrigin: window.location.origin,
          tags: { platform: Capacitor.getPlatform(), native: String(Capacitor.isNativePlatform()) },
        },
        undefined,
        diagnosticsGate
      )
    : null,
  analytics: analyticsSelection.driver,
});
```

Imports to add: `createPrivacyChoices` and `type PrivacyPurpose` from `./application/privacyChoices.ts`; `type ConsentGate` from `./engine/core/platform/sentryCrashDriver.ts`; `requestPrivacyChoices` from `./presentation/consent/consentGate.ts` (replacing `requestAnalyticsConsent`); `PRIVACY_REGISTRY_KEY` from `./presentation/privacyServices.ts`.

In `startGame`, replace the two consent lines with:
```ts
  // Hỏi một lần khi bản build có dịch vụ tùy chọn; lựa chọn nào cũng vào được game.
  if (offeredPurposes.length > 0 && !privacy.decided()) {
    privacy.set(await requestPrivacyChoices({ offered: offeredPurposes, policyUrl }));
  }
  // Khởi tạo GA ngay nếu đã đồng ý (SDK bỏ sự kiện gửi trước khi phiên mở).
  analyticsSelection.warmUp?.();
```

After `game.registry.set(ADS_REGISTRY_KEY, platform.ads);` add:
```ts
  game.registry.set(PRIVACY_REGISTRY_KEY, { choices: privacy, offered: offeredPurposes, policyUrl });
```

- [ ] **Step 3: Full verification**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all test files pass (baseline 2282 tests plus the new ones). Also run `grep -rn "analyticsConsent\|requestAnalyticsConsent\|setting_privacy\"" src tests` → no matches.

- [ ] **Step 4: Update `CHANGELOG.md` and `STATUS.md`**

Add at the top of `## [Unreleased]` in `CHANGELOG.md`:
```markdown
### Changed (privacy consent)
- Consent is now per service and optional: a first-launch screen offers "Reject all" / "Accept all" (equal buttons) and "Options" with one switch per service in this build (Android: gameplay statistics via GameAnalytics and error reports via Sentry; web: error reports only). Declining never blocks play. Choices live in `PrivacyChoices` (`application/privacyChoices.ts`, key `nozvi.privacy.v2`); the old `nozvi.analytics.consent.v1` choice is ignored, so everyone is asked again.
- Sentry starts only with diagnostics consent (`ConsentGate` in `sentryCrashDriver.ts`); withdrawing calls `close()` and later calls are no-ops; turning it on again re-initialises.
- GameAnalytics uses a game-owned random user ID (`configureUserId`). Withdrawing stops submission, deletes the SDK's unsent-event store (`GA::<key>::ga_event`, `ga_session`, `ga_progression`, `ga_items`) and creates a new ID. Turning statistics back on in the same session takes effect from the next launch (the SDK cannot change user ID while running).
- Settings: the EEA/UK-only "Privacy settings" row is replaced by an always-visible "Privacy" row opening `PrivacyDialog` (switches, "Ad choices" for UMP in EEA/UK, the shortened user ID with Copy, Privacy Policy link from `VITE_PRIVACY_POLICY_URL`).
- New `privacy_*` strings in all ten locales; `setting_privacy` replaced by `setting_privacy_row`.
```
In `STATUS.md`, replace the Analytics bullet's "Still to do: real consent UI and wording..." with: "Consent UI done (2026-11-02, see CHANGELOG). Still to do: native review of the machine-drafted privacy strings (es, pt-BR, fr, de, ja, ko, zh-CN, id); set `VITE_PRIVACY_POLICY_URL` once the policy is published; network check on device (Step 5 of the plan); Privacy Policy v2 (next)." and update `Last updated` to 2026-11-02.

- [ ] **Step 5: Manual network check (evidence for the policy)**

Web (`npm run dev` with `VITE_SENTRY_DEV=true` and a DSN in `.env.local`), DevTools Network tab filtered by `sentry`:
1. Clear site data, reload: the screen shows only "Error reports" under Options; no request to `*.sentry.io` before choosing.
2. "Reject all": still no Sentry request; `window.__crashTest('capture')` sends nothing.
3. Settings → Privacy → turn Error reports on: a session envelope goes out; `__crashTest('capture')` sends one event.
4. Turn it off: `__crashTest('capture')` sends nothing.

Android (debug APK with GA keys and DSN, `chrome://inspect` on the WebView), filter `gameanalytics` and `sentry`:
1. Fresh install: no request to either before choosing.
2. "Accept all": both send; play a level, a progression event goes out within ~8 s.
3. Settings → Privacy → Statistics off: no further GA requests; `localStorage` has no `GA::<key>::ga_event`. Relaunch: still none.

Record the results (date, device, pass/fail per step) in `docs/testing/release-checklist-compliance.md` under COMP-01.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/vite-env.d.ts STATUS.md CHANGELOG.md docs/testing/release-checklist-compliance.md
git commit -m "feat: wire privacy consent into boot, Settings and both SDK drivers"
```

---

## Self-review notes

- Spec §1 → Task 1; §2 GA → Task 2; §2 Sentry → Task 3; §2 main.ts → Task 7; §3 first-launch → Task 5; §3 Settings/dialog → Task 6; §4 → Task 4; §5 unit tests → each task, manual → Task 7 Step 5. Out-of-scope items are not planned.
- Names used across tasks: `PrivacyChoices`, `PrivacyPurpose`, `PrivacyState`, `createPrivacyChoices`, `AnalyticsPrivacy`, `clearGameAnalyticsStore`, `ConsentGate`, `ALWAYS_ON`, `choicesFor`, `requestPrivacyChoices`, `PRIVACY_REGISTRY_KEY`, `privacyServices`, `shortId`, `PrivacyDialog`, `setting_privacy_row`.
- Re-enable in the same session after the SDK ran: resolved from the SDK source (spec left it open): resumes on next launch.
