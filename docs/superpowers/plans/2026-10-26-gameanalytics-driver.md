# GameAnalytics Driver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send level-progress events from `LevelTracker` to GameAnalytics on the Android build, behind a mandatory first-launch consent screen.

**Architecture:** A new `AnalyticsDriver` (`gameAnalyticsDriver.ts`) plugs into the existing `createAnalytics` queue. The `gameanalytics` npm SDK is loaded with a dynamic `import()` and initialised in the background (same pattern as `sentryCrashDriver.ts`), and only after consent is stored. A placeholder DOM overlay asks the player to agree before the game starts; the real UI replaces it later.

**Tech Stack:** TypeScript, Vite 6, Vitest 2.1, Capacitor 8 (Android WebView), npm `gameanalytics`.

**Spec:** `docs/superpowers/specs/2026-10-26-gameanalytics-driver-design.md`

## Global Constraints

- Branch: `feature/game-analytics` (cut from `feature/sentry-crash-reporting`). Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commit only when the owner agrees; the commit steps below are the intended points.
- Layering: `domain` -> `application` -> `presentation`; `infrastructure` holds adapters. Scene changes only through `director.go(...)` (the consent overlay is DOM, not a scene).
- Dependencies are pinned to exact versions (`npm install --save-exact`).
- Driver and consent code must never throw into the game: a hung or blocked SDK is a no-op.
- GameAnalytics limits: `score` is an integer on `Complete`/`Fail`; design `eventId` has at most 5 segments of at most 32 characters; never use `levelId` as a custom dimension.
- Keys come only from `.env.local` (`VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY`); never commit or print them.
- Driver is active only when both keys exist AND `Capacitor.isNativePlatform()`. Web and dev keep the console driver (dev only) or nothing.
- Code comments are Vietnamese, matching the surrounding code; tests use Vietnamese test names.
- Before declaring done: `npm run typecheck` and `npm test`.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/infrastructure/analyticsConsent.ts` (create) | Read/write the stored consent flag |
| `src/infrastructure/gameAnalyticsDriver.ts` (create) | `TelemetryEvent` -> GameAnalytics calls; consent gating; lazy init |
| `src/infrastructure/gameAnalyticsSdk.ts` (create) | `loadGameAnalytics()`: dynamic import adapter around the real SDK |
| `src/infrastructure/analyticsSetup.ts` (create) | `selectAnalyticsDriver(...)`: choose driver and whether consent is required |
| `src/presentation/consent/consentGate.ts` (create) | Placeholder DOM overlay, resolves when the player agrees |
| `src/main.ts` (modify) | Use `selectAnalyticsDriver`; await the gate in `startGame` |
| `src/vite-env.d.ts` (modify) | Declare the two env vars |
| `tests/analyticsConsent.test.ts`, `tests/gameAnalyticsDriver.test.ts`, `tests/analyticsSetup.test.ts`, `tests/consentGate.test.ts` (create) | Unit tests, fake SDK and fake storage |

---

### Task 0: Commit the existing level-tracking work

The tracker, console driver and `PlayScene` wiring are already written and green but uncommitted on this branch. Commit them first so the driver work is a clean diff.

**Files:**
- Commit: `src/application/levelTracker.ts`, `src/application/telemetry.ts`, `src/infrastructure/consoleAnalyticsDriver.ts`, `src/presentation/levelTracking.ts`, `src/presentation/scenes/PlayScene.ts`, `src/main.ts`, `tests/levelTracker.test.ts`, `tests/consoleAnalyticsDriver.test.ts`, `tests/platformServices.test.ts`, `CHANGELOG.md`, `STATUS.md`
- Do not add: `docs/tmp/`

- [x] **Step 1: Verify green**

Run: `npm run typecheck && npx vitest run tests/levelTracker.test.ts tests/consoleAnalyticsDriver.test.ts tests/platformServices.test.ts`
Expected: typecheck clean, all tests pass.

- [x] **Step 2: Commit (owner approval required)**

```bash
git add src/application/levelTracker.ts src/application/telemetry.ts src/infrastructure/consoleAnalyticsDriver.ts src/presentation/levelTracking.ts src/presentation/scenes/PlayScene.ts src/main.ts tests/levelTracker.test.ts tests/consoleAnalyticsDriver.test.ts tests/platformServices.test.ts CHANGELOG.md STATUS.md
git commit -m "feat: track level start, complete and abandon through AnalyticsPort

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Consent store

**Files:**
- Create: `src/infrastructure/analyticsConsent.ts`
- Test: `tests/analyticsConsent.test.ts`

**Interfaces:**
- Produces:
  - `ANALYTICS_CONSENT_KEY: 'nozvi.analytics.consent.v1'`
  - `type ConsentStore = Pick<Storage, 'getItem' | 'setItem'>`
  - `isAnalyticsConsentGranted(store?: ConsentStore): boolean`
  - `grantAnalyticsConsent(store?: ConsentStore): void`
  - Default store is `getSafeStorage() ?? memoryStorage`, so consent still holds for the session when `localStorage` is blocked.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  grantAnalyticsConsent,
  isAnalyticsConsentGranted,
  type ConsentStore,
} from '../src/infrastructure/analyticsConsent.ts';

function fakeStore(): ConsentStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('analyticsConsent', () => {
  test('chưa lưu gì thì chưa đồng ý', () => {
    expect(isAnalyticsConsentGranted(fakeStore())).toBe(false);
  });

  test('grant ghi cờ và các lần đọc sau thấy đã đồng ý', () => {
    const store = fakeStore();
    grantAnalyticsConsent(store);
    expect(store.data.get(ANALYTICS_CONSENT_KEY)).toBe('granted');
    expect(isAnalyticsConsentGranted(store)).toBe(true);
  });

  test('giá trị lạ trong storage không được coi là đồng ý', () => {
    const store = fakeStore();
    store.setItem(ANALYTICS_CONSENT_KEY, 'true');
    expect(isAnalyticsConsentGranted(store)).toBe(false);
  });

  test('storage ném lỗi thì đọc trả về false và ghi không ném', () => {
    const broken: ConsentStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isAnalyticsConsentGranted(broken)).toBe(false);
    expect(() => grantAnalyticsConsent(broken)).not.toThrow();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/analyticsConsent.test.ts`
Expected: FAIL, "Failed to load url ../src/infrastructure/analyticsConsent.ts".

- [x] **Step 3: Write minimal implementation**

```ts
import { getSafeStorage, memoryStorage } from './safeStorage.ts';

export const ANALYTICS_CONSENT_KEY = 'nozvi.analytics.consent.v1';

export type ConsentStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Không có localStorage thì dùng bộ nhớ chung: người chơi đã đồng ý trong phiên không bị hỏi lại. */
function defaultStore(): ConsentStore {
  return getSafeStorage() ?? memoryStorage;
}

export function isAnalyticsConsentGranted(store: ConsentStore = defaultStore()): boolean {
  try {
    return store.getItem(ANALYTICS_CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function grantAnalyticsConsent(store: ConsentStore = defaultStore()): void {
  try {
    store.setItem(ANALYTICS_CONSENT_KEY, 'granted');
  } catch {
    // Không ghi được thì lần mở sau hỏi lại; không chặn game.
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/analyticsConsent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add src/infrastructure/analyticsConsent.ts tests/analyticsConsent.test.ts
git commit -m "feat: add analytics consent store

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: GameAnalytics driver (mapping, consent gating, lazy init)

**Files:**
- Create: `src/infrastructure/gameAnalyticsDriver.ts`
- Test: `tests/gameAnalyticsDriver.test.ts`

**Interfaces:**
- Consumes: `initInBackground`, `AnalyticsDriver` from `./platformServices.ts`; `isAnalyticsConsentGranted` from `./analyticsConsent.ts`; `TelemetryEvent` from `../application/telemetry.ts`.
- Produces:
  - `type GameAnalyticsConfig = { gameKey: string; secretKey: string; build: string }`
  - `type ProgressionStatus = 'Start' | 'Complete' | 'Fail'`
  - `type GameAnalyticsLike = { configureBuild(build: string): void; initialize(gameKey: string, secretKey: string): void; addProgressionEvent(status: ProgressionStatus, progression01: string, progression02?: string, progression03?: string, score?: number): void; addDesignEvent(eventId: string, value?: number): void }`
  - `createGameAnalyticsDriver(config: GameAnalyticsConfig, load: () => Promise<GameAnalyticsLike>, isConsentGranted?: () => boolean): AnalyticsDriver`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest';
import { createGameAnalyticsDriver } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { GameAnalyticsLike } from '../src/infrastructure/gameAnalyticsDriver.ts';
import type { TelemetryEvent } from '../src/application/telemetry.ts';

const CONFIG = { gameKey: 'gk', secretKey: 'sk', build: '1.0.0' };

function fakeSdk() {
  const calls: unknown[][] = [];
  const sdk: GameAnalyticsLike = {
    configureBuild: (...a) => void calls.push(['configureBuild', ...a]),
    initialize: (...a) => void calls.push(['initialize', ...a]),
    addProgressionEvent: (...a) => void calls.push(['progression', ...a]),
    addDesignEvent: (...a) => void calls.push(['design', ...a]),
  };
  return { sdk, calls };
}

const START: TelemetryEvent = { type: 'level_start', levelId: '1-3', chapter: 1, mode: 'campaign', timestamp: 1 };
const COMPLETE: TelemetryEvent = {
  type: 'level_complete', levelId: '1-3', chapter: 1, mode: 'campaign',
  elapsedMs: 8400, stars: 2, resetCount: 1, moveCount: 5, rotateCount: 0, timestamp: 2,
};
const ABANDON: TelemetryEvent = {
  type: 'level_abandon', levelId: 'endless-1-7', chapter: 1, mode: 'endless',
  elapsedMs: 42000, resetCount: 3, moveCount: 8, rotateCount: 1, reason: 'level-select', timestamp: 3,
};

describe('gameAnalyticsDriver', () => {
  test('level_start gửi progression Start theo chương và mã màn', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(START);
    expect(calls).toContainEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('level_complete gửi progression Complete kèm số sao và design event số đếm', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(COMPLETE);
    expect(calls).toContainEqual(['progression', 'Complete', 'chapter1', '1-3', undefined, 2]);
    expect(calls).toContainEqual(['design', 'Complete:Moves', 5]);
    expect(calls).toContainEqual(['design', 'Complete:Resets', 1]);
  });

  test('level_abandon gửi progression Fail và design event Abandon', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(ABANDON);
    expect(calls).toContainEqual(['progression', 'Fail', 'chapter1', 'endless-1-7']);
    expect(calls).toContainEqual(['design', 'Abandon:endless-1-7', 3]);
  });

  test('mỗi đoạn của design event không vượt 32 ký tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track({ ...ABANDON, levelId: 'endless-1-' + '9'.repeat(40) });
    const design = calls.find((c) => c[0] === 'design') as [string, string, number];
    for (const segment of design[1].split(':')) expect(segment.length).toBeLessThanOrEqual(32);
  });

  test('chưa đồng ý thì không nạp SDK và không gửi gì', async () => {
    let loaded = false;
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return sdk;
    }, () => false);
    await driver.track(START);
    expect(loaded).toBe(false);
    expect(calls).toEqual([]);
  });

  test('đồng ý thì cấu hình build, khởi tạo đúng một lần rồi gửi theo thứ tự', async () => {
    const { sdk, calls } = fakeSdk();
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await driver.track(START);
    await driver.track(COMPLETE);
    const names = calls.map((c) => c[0]);
    expect(names.filter((n) => n === 'initialize')).toHaveLength(1);
    expect(calls[0]).toEqual(['configureBuild', '1.0.0']);
    expect(calls[1]).toEqual(['initialize', 'gk', 'sk']);
    expect(calls[2]).toEqual(['progression', 'Start', 'chapter1', '1-3']);
  });

  test('loại sự kiện không theo dõi thì bị bỏ và không nạp SDK', async () => {
    let loaded = false;
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      loaded = true;
      return fakeSdk().sdk;
    }, () => true);
    await driver.track({ type: 'piece_rotate', levelId: '1-1', pieceId: 'a', timestamp: 1 });
    expect(loaded).toBe(false);
  });

  test('nạp SDK hỏng thì không ném lỗi', async () => {
    const driver = createGameAnalyticsDriver(CONFIG, async () => {
      throw new Error('blocked');
    }, () => true);
    await expect(driver.track(START)).resolves.toBeUndefined();
  });

  test('một lệnh SDK ném lỗi không chặn các lệnh sau và không ném ra ngoài', async () => {
    const { sdk, calls } = fakeSdk();
    sdk.addDesignEvent = () => {
      throw new Error('boom');
    };
    const driver = createGameAnalyticsDriver(CONFIG, async () => sdk, () => true);
    await expect(driver.track(COMPLETE)).resolves.toBeUndefined();
    expect(calls.some((c) => c[0] === 'progression')).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gameAnalyticsDriver.test.ts`
Expected: FAIL, "Failed to load url ../src/infrastructure/gameAnalyticsDriver.ts".

- [x] **Step 3: Write minimal implementation**

```ts
import type { TelemetryEvent } from '../application/telemetry.ts';
import { isAnalyticsConsentGranted } from './analyticsConsent.ts';
import { initInBackground } from './platformServices.ts';
import type { AnalyticsDriver } from './platformServices.ts';

export type GameAnalyticsConfig = { gameKey: string; secretKey: string; build: string };

export type ProgressionStatus = 'Start' | 'Complete' | 'Fail';

/** Phần của SDK mà game dùng; giữ hẹp để test thay bằng đồ giả. Bản thật bọc ở `gameAnalyticsSdk.ts`. */
export type GameAnalyticsLike = {
  configureBuild(build: string): void;
  initialize(gameKey: string, secretKey: string): void;
  addProgressionEvent(
    status: ProgressionStatus,
    progression01: string,
    progression02?: string,
    progression03?: string,
    score?: number
  ): void;
  addDesignEvent(eventId: string, value?: number): void;
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
        (ga) => ga.addDesignEvent('Complete:Moves', event.moveCount),
        (ga) => ga.addDesignEvent('Complete:Resets', event.resetCount),
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
 * Chưa đồng ý thì không nạp và không khởi tạo SDK (khởi tạo cũng có thể gửi sự kiện phiên). Đồng ý rồi thì
 * SDK nạp bằng `import()` động ở nền (`initInBackground`); tải hỏng hay treo thì mọi lệnh là no-op.
 * Sự kiện khi chưa đồng ý bị bỏ, không giữ lại.
 */
export function createGameAnalyticsDriver(
  config: GameAnalyticsConfig,
  load: () => Promise<GameAnalyticsLike>,
  isConsentGranted: () => boolean = isAnalyticsConsentGranted
): AnalyticsDriver {
  let ready: Promise<GameAnalyticsLike | null> | null = null;
  const sdk = (): Promise<GameAnalyticsLike | null> =>
    (ready ??= initInBackground('gameanalytics', async () => {
      const ga = await load();
      ga.configureBuild(config.build);
      ga.initialize(config.gameKey, config.secretKey);
      return ga;
    }));

  return {
    track(event) {
      if (!isConsentGranted()) return;
      const calls = callsFor(event);
      if (calls.length === 0) return;
      return sdk().then((ga) => {
        if (!ga) return;
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

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gameAnalyticsDriver.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add src/infrastructure/gameAnalyticsDriver.ts tests/gameAnalyticsDriver.test.ts
git commit -m "feat: add GameAnalytics driver gated by consent

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Real SDK loader

The unit tests use a fake SDK, so this task is where the real package API is confirmed. The adapter turns the driver's string statuses into the SDK's enum.

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/infrastructure/gameAnalyticsSdk.ts`

**Interfaces:**
- Consumes: `GameAnalyticsLike`, `ProgressionStatus` from `./gameAnalyticsDriver.ts`.
- Produces: `loadGameAnalytics(): Promise<GameAnalyticsLike>`.

- [x] **Step 1: Install the SDK pinned**

Run: `npm install --save-exact gameanalytics@5.0.0`
Expected: `package.json` lists `"gameanalytics": "5.0.0"` under `dependencies`.

- [x] **Step 2: Confirm the real API before writing the adapter**

Read the installed typings and entry (`node_modules/gameanalytics/` — the `.d.ts` or `package.json` `types`/`main`/`module`/`exports`). Confirm all of:
1. How the package exports `GameAnalytics` and `EGAProgressionStatus` (named export, default export or namespace).
2. The exact parameter order of `addProgressionEvent`, including where `score` goes (the docs show `(status, progression01, progression02, progression03)` plus an optional `score`/`fields`).
3. That `configureBuild`, `initialize`, `addDesignEvent` exist with the shapes used in `GameAnalyticsLike`.

If any of these differs from Step 3's code, change only the adapter in Step 3 (the driver and its tests stay as they are), and record the difference in the spec's "Open items".

- [x] **Step 3: Write the adapter**

```ts
import type { GameAnalyticsLike, ProgressionStatus } from './gameAnalyticsDriver.ts';

/** Hình dạng thực tế của `gameanalytics`, đã đối chiếu với .d.ts ở bước xác nhận API. */
type GameAnalyticsModule = {
  GameAnalytics: {
    configureBuild(build: string): void;
    initialize(gameKey: string, secretKey: string): void;
    addProgressionEvent(
      status: unknown,
      progression01: string,
      progression02?: string,
      progression03?: string,
      score?: number
    ): void;
    addDesignEvent(eventId: string, value?: number): void;
  };
  EGAProgressionStatus: Record<ProgressionStatus, unknown>;
};

/** Nạp SDK thật bằng `import()` động (chunk riêng) và đổi trạng thái chuỗi sang enum của SDK. */
export async function loadGameAnalytics(): Promise<GameAnalyticsLike> {
  const imported = (await import('gameanalytics')) as unknown as { gameanalytics: GameAnalyticsModule };
  const { GameAnalytics, EGAProgressionStatus } = imported.gameanalytics;
  return {
    configureBuild: (build) => GameAnalytics.configureBuild(build),
    initialize: (gameKey, secretKey) => GameAnalytics.initialize(gameKey, secretKey),
    addProgressionEvent: (status, p1, p2, p3, score) =>
      GameAnalytics.addProgressionEvent(EGAProgressionStatus[status], p1, p2, p3, score),
    addDesignEvent: (eventId, value) => GameAnalytics.addDesignEvent(eventId, value),
  };
}
```

- [x] **Step 4: Type-check and confirm a separate chunk**

Run: `npm run typecheck`
Expected: clean. Then `npm run build` and confirm the output lists a separate chunk for `gameanalytics` (not merged into the main bundle). If `import('gameanalytics')` fails type-check for lack of typings, add a one-line `declare module 'gameanalytics';` in `src/vite-env.d.ts`.

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add package.json package-lock.json src/infrastructure/gameAnalyticsSdk.ts src/vite-env.d.ts
git commit -m "feat: add GameAnalytics SDK loader

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Driver selection

**Files:**
- Create: `src/infrastructure/analyticsSetup.ts`
- Test: `tests/analyticsSetup.test.ts`
- Modify: `src/vite-env.d.ts`

**Interfaces:**
- Consumes: `createGameAnalyticsDriver` (Task 2), `loadGameAnalytics` (Task 3), `createConsoleAnalyticsDriver` from `./consoleAnalyticsDriver.ts`, `AnalyticsDriver` from `./platformServices.ts`.
- Produces:
  - `type AnalyticsSelection = { driver: AnalyticsDriver | null; requiresConsent: boolean }`
  - `selectAnalyticsDriver(input: { gameKey?: string; secretKey?: string; isNative: boolean; isDev: boolean; build: string }): AnalyticsSelection`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { selectAnalyticsDriver } from '../src/infrastructure/analyticsSetup.ts';

const KEYS = { gameKey: 'gk', secretKey: 'sk', build: '1.0.0' };

describe('selectAnalyticsDriver', () => {
  test('app native có đủ hai key thì dùng GameAnalytics và cần consent', () => {
    const out = selectAnalyticsDriver({ ...KEYS, isNative: true, isDev: false });
    expect(out.driver).not.toBeNull();
    expect(out.requiresConsent).toBe(true);
  });

  test('thiếu một key thì không có driver GameAnalytics', () => {
    const out = selectAnalyticsDriver({ gameKey: 'gk', build: '1.0.0', isNative: true, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });

  test('web có đủ key vẫn không bật GameAnalytics', () => {
    const out = selectAnalyticsDriver({ ...KEYS, isNative: false, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });

  test('web dev không key dùng driver console và không cần consent', () => {
    const out = selectAnalyticsDriver({ build: '1.0.0', isNative: false, isDev: true });
    expect(out.driver).not.toBeNull();
    expect(out.requiresConsent).toBe(false);
  });

  test('bản release không key không có driver nào', () => {
    const out = selectAnalyticsDriver({ build: '1.0.0', isNative: false, isDev: false });
    expect(out).toEqual({ driver: null, requiresConsent: false });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/analyticsSetup.test.ts`
Expected: FAIL, "Failed to load url ../src/infrastructure/analyticsSetup.ts".

- [x] **Step 3: Write minimal implementation**

```ts
import { createConsoleAnalyticsDriver } from './consoleAnalyticsDriver.ts';
import { createGameAnalyticsDriver } from './gameAnalyticsDriver.ts';
import { loadGameAnalytics } from './gameAnalyticsSdk.ts';
import type { AnalyticsDriver } from './platformServices.ts';

export type AnalyticsSelection = { driver: AnalyticsDriver | null; requiresConsent: boolean };

export type AnalyticsSelectionInput = {
  gameKey?: string;
  secretKey?: string;
  isNative: boolean;
  isDev: boolean;
  build: string;
};

/**
 * GameAnalytics chỉ bật trong app native khi đủ hai key; khi đó game phải xin consent trước khi vào.
 * Còn lại: bản dev in console, bản release không có driver.
 */
export function selectAnalyticsDriver(input: AnalyticsSelectionInput): AnalyticsSelection {
  const { gameKey, secretKey, isNative, isDev, build } = input;
  if (gameKey && secretKey && isNative) {
    return { driver: createGameAnalyticsDriver({ gameKey, secretKey, build }, loadGameAnalytics), requiresConsent: true };
  }
  if (isDev) return { driver: createConsoleAnalyticsDriver(), requiresConsent: false };
  return { driver: null, requiresConsent: false };
}
```

Add to `src/vite-env.d.ts` inside `ImportMetaEnv`:

```ts
  /** GameAnalytics game key; with the secret key it turns GameAnalytics on in the native app. Put both in `.env.local`, never commit them. */
  readonly VITE_GA_GAME_KEY?: string;
  readonly VITE_GA_SECRET_KEY?: string;
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/analyticsSetup.test.ts && npm run typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add src/infrastructure/analyticsSetup.ts tests/analyticsSetup.test.ts src/vite-env.d.ts
git commit -m "feat: select analytics driver by platform and keys

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Consent gate (placeholder)

Tests run in the node environment (no DOM), so only the "already agreed" branch is unit-tested; the overlay is checked by hand in Task 7.

**Files:**
- Create: `src/presentation/consent/consentGate.ts`
- Test: `tests/consentGate.test.ts`

**Interfaces:**
- Consumes: `isAnalyticsConsentGranted`, `grantAnalyticsConsent` from `../../infrastructure/analyticsConsent.ts`.
- Produces: `requestAnalyticsConsent(deps?: { isGranted?: () => boolean; grant?: () => void; doc?: Document }): Promise<void>`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { requestAnalyticsConsent } from '../src/presentation/consent/consentGate.ts';

describe('requestAnalyticsConsent', () => {
  test('đã đồng ý trước đó thì resolve ngay và không chạm DOM', async () => {
    let granted = 0;
    await expect(
      requestAnalyticsConsent({
        isGranted: () => true,
        grant: () => void (granted += 1),
        doc: undefined,
      })
    ).resolves.toBeUndefined();
    expect(granted).toBe(0);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/consentGate.test.ts`
Expected: FAIL, "Failed to load url ../src/presentation/consent/consentGate.ts".

- [x] **Step 3: Write minimal implementation**

```ts
import { grantAnalyticsConsent, isAnalyticsConsentGranted } from '../../infrastructure/analyticsConsent.ts';

export type ConsentGateDeps = {
  isGranted?: () => boolean;
  grant?: () => void;
  doc?: Document;
};

/**
 * PLACEHOLDER: lớp phủ DOM một câu hỏi, một nút, một ngôn ngữ. Chủ dự án sẽ thay giao diện và lời văn thật;
 * chỉ cần giữ hợp đồng: resolve khi người chơi đã đồng ý (hoặc đã đồng ý từ trước).
 */
export function requestAnalyticsConsent(deps: ConsentGateDeps = {}): Promise<void> {
  const isGranted = deps.isGranted ?? (() => isAnalyticsConsentGranted());
  const grant = deps.grant ?? (() => grantAnalyticsConsent());
  if (isGranted()) return Promise.resolve();
  const doc = deps.doc ?? document;

  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:24px;padding:32px;background:#1A2470;color:#fff;text-align:center;' +
      "font-family:'Be Vietnam Pro',sans-serif;";

    const text = doc.createElement('p');
    text.style.cssText = 'max-width:420px;margin:0;font-size:18px;line-height:1.5;';
    text.textContent =
      'Nozvi thu thập dữ liệu chơi ẩn danh (màn bạn chơi, thời gian, số sao) để cải thiện game. ' +
      'Nhấn Đồng ý để tiếp tục.';

    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Đồng ý';
    button.style.cssText =
      'min-width:180px;min-height:48px;border:0;border-radius:24px;font-size:18px;font-weight:700;' +
      'background:#F5C842;color:#1A2470;';
    button.addEventListener('click', () => {
      grant();
      overlay.remove();
      resolve();
    });

    overlay.append(text, button);
    doc.body.appendChild(overlay);
  });
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/consentGate.test.ts && npm run typecheck`
Expected: PASS (1 test), typecheck clean.

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add src/presentation/consent/consentGate.ts tests/consentGate.test.ts
git commit -m "feat: add placeholder analytics consent gate

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire into `main.ts`

**Files:**
- Modify: `src/main.ts` (the `createPlatformServices` block near the top, and `startGame`)

**Interfaces:**
- Consumes: `selectAnalyticsDriver` (Task 4), `requestAnalyticsConsent` (Task 5), `Capacitor` from `@capacitor/core`.

- [x] **Step 1: Replace the driver selection**

In `src/main.ts`, replace the imports of `createConsoleAnalyticsDriver` with:

```ts
import { Capacitor } from '@capacitor/core';
import { selectAnalyticsDriver } from './infrastructure/analyticsSetup.ts';
import { requestAnalyticsConsent } from './presentation/consent/consentGate.ts';
```

Replace the `createPlatformServices({ ... })` block with:

```ts
// Không có DSN thì không có driver: mọi lệnh là no-op, game chạy y như chưa gắn SDK.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const analyticsSelection = selectAnalyticsDriver({
  gameKey: import.meta.env.VITE_GA_GAME_KEY,
  secretKey: import.meta.env.VITE_GA_SECRET_KEY,
  isNative: Capacitor.isNativePlatform(),
  isDev: import.meta.env.DEV,
  build: APP_VERSION,
});
const platform = createPlatformServices({
  crash: sentryDsn
    ? createSentryCrashDriver({ dsn: sentryDsn, release: APP_VERSION, environment: import.meta.env.MODE })
    : null,
  analytics: analyticsSelection.driver,
});
```

(Keep the existing `installGlobalErrorHandlers`, `levelTrackerService` and `pagehide` lines unchanged. Do not duplicate the earlier comment line.)

- [x] **Step 2: Await consent before the game starts**

In `startGame`, directly after `await waitForFonts();` add:

```ts
  // GameAnalytics bật thì người chơi phải đồng ý chia sẻ dữ liệu trước khi vào game.
  if (analyticsSelection.requiresConsent) await requestAnalyticsConsent();
```

- [x] **Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; the full suite passes. If a repo-wide test fails because of the new Vietnamese literal or an import-boundary rule, read the failing test, fix the code to satisfy the rule (do not weaken the test), and re-run.

- [ ] **Step 4: Commit (owner approval required)**

```bash
git add src/main.ts
git commit -m "feat: wire GameAnalytics driver and consent gate into boot

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and on-device check

**Files:**
- Modify: `README.md`, `STATUS.md`, `CHANGELOG.md`, `docs/testing/release-checklist-monetization.md`

- [x] **Step 1: README env note**

Add a short section to `README.md` after "Dev tools":

```markdown
## Analytics (GameAnalytics)

Level analytics go to GameAnalytics only in the native Android app. Put both keys in `.env.local` (git-ignored):

    VITE_GA_GAME_KEY=...
    VITE_GA_SECRET_KEY=...

With both keys set, the app asks the player to agree to share play data on first launch and does not start the game until they do. Without them nothing is loaded or sent. `npm run dev` prints events to the console instead.
```

- [x] **Step 2: STATUS, CHANGELOG, MON-06**

- `CHANGELOG.md` under `[Unreleased] / Added`: one entry for the GameAnalytics driver (consent-gated, native only, progression + design events, console driver for dev) and one for the placeholder consent gate.
- `STATUS.md`: replace the "Level tracking" next-step bullet with the current state: driver and placeholder consent are in; still to do = real consent UI and wording, Privacy Policy / Data Safety (COMP-01), on-device check. Set "Last updated" to the working date and update "Last worked on" to `feature/game-analytics`.
- `docs/testing/release-checklist-monetization.md`: change the MON-06 row to reflect that GameAnalytics is integrated for Android with the events `level_start/complete/abandon` mapped to progression and design events; keep it open until the on-device check below passes.

- [ ] **Step 3: On-device check (manual, owner)**

1. Put the two keys in `.env.local`.
2. Run `npm run android:build`; install the debug APK on a phone (INTERNET permission is already in the manifest).
3. First launch: the consent overlay shows; the game does not start until **Đồng ý** is pressed. Kill and relaunch: no overlay.
4. Play: win one level, reset then win another, leave one mid-way via the pause menu.
5. In the GameAnalytics dashboard confirm progression events for the played levels (`chapter1` / `1-1`, ...), a `Fail` for the abandoned level, and the design events `Complete:Moves`, `Complete:Resets`, `Abandon:<levelId>`. Events can take a while to appear.
6. Record the result, and any difference between the SDK and the spec (for example the `score` position), in `STATUS.md`.

- [x] **Step 4: Final verification**

Run: `npm run typecheck && npm test`
Expected: both pass. Run `npm run content:validate` only if levels were touched (they are not).

- [ ] **Step 5: Commit (owner approval required)**

```bash
git add README.md STATUS.md CHANGELOG.md docs/testing/release-checklist-monetization.md
git commit -m "docs: document GameAnalytics setup and update status

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
