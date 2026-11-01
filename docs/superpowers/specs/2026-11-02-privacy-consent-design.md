# Privacy consent for GameAnalytics and Sentry — design

Date: 2026-11-02 · Branch: `feature/game-analytics` · Status: approved in chat, awaiting spec review

## Goal

Players choose separately whether to share gameplay analytics (GameAnalytics) and crash diagnostics (Sentry).
Declining never blocks play. Choices can be changed at any time in Settings and take effect immediately.
Nothing optional is initialised or sent before the player chooses. The Privacy Policy (written after this work)
describes exactly this behaviour.

## Decisions

| Topic | Decision |
| --- | --- |
| Platforms | Android and web. Web offers only diagnostics (Sentry); GameAnalytics and AdMob are Android only. |
| First-launch screen | "Reject all" and "Accept all" as equal buttons, plus "Options" that reveals one switch per service and "Save choices". |
| Settings | The UMP "Privacy settings" row is replaced by an always-visible "Privacy" row that opens `PrivacyDialog`. |
| Order with UMP | Game screen first; UMP shows later when ads initialise (already the case: `platform.ads.init()` runs after consent in `main.ts`). |
| Architecture | One `PrivacyChoices` source of truth; drivers subscribe to it (approach A). |
| Old consent | `nozvi.analytics.consent.v1` is ignored; everyone is asked again (old choice did not cover Sentry and had no decline). |
| Policy link | `VITE_PRIVACY_POLICY_URL`; the link is hidden when unset. |
| Sentry sessions | Kept (crash-free rate); disclosed in the policy. |

## 1. `PrivacyChoices` (application layer)

File `src/application/privacyChoices.ts`.

- Stored at localStorage key `nozvi.privacy.v2` as JSON `{ "analytics": boolean, "diagnostics": boolean, "decided": boolean, "userId": string }`.
- API:
  - `get(): { analytics: boolean; diagnostics: boolean }` — both `false` until decided.
  - `decided(): boolean`
  - `set(next: Partial<{ analytics: boolean; diagnostics: boolean }>): void` — marks `decided`, persists, notifies listeners.
  - `userId(): string` — random UUID created on first use.
  - `onChange(listener): () => void` — returns an unsubscribe function.
- Turning `analytics` from `true` to `false` replaces `userId` with a new UUID, so later data cannot be linked to earlier data.
- Storage unavailable or corrupt: fall back to memory (`safeStorage` pattern); the player is asked again on the next launch. Corrupt JSON is treated as "not decided".
- Pure logic, storage injected, so it is unit-testable without a browser.

## 2. Drivers

The ports (`CrashReporterPort`, `AnalyticsPort`) do not change; only drivers and `main.ts` wiring change.

### GameAnalytics (`infrastructure/gameAnalyticsDriver.ts`, `gameAnalyticsSdk.ts`)

- Replace the `isConsentGranted` callback with `PrivacyChoices`.
- Enabled: load the SDK lazily as today, call `configureUserId(choices.userId())` before `initialize`, then wait for `isReady`.
- Disabled: `setEnabledEventSubmission(false)`, remove the SDK's unsent-event store from localStorage (exact keys confirmed against `gameanalytics` 5.0.0 during implementation), drop the in-memory queue entries (`track` already checks consent at flush time).
- Re-enabled in the same session: if the SDK can switch user id while running, resume with the new id; otherwise resume only from the next launch. Verified during implementation; whichever holds is covered by a test and stated in the policy.
- The 10 s ready-wait giving up for the whole session is out of scope here.

### Sentry (`engine/core/platform/sentryCrashDriver.ts`)

- The driver takes an `enabled()` getter and an `onChange` subscription instead of initialising in the constructor.
- `init` runs only when diagnostics is on. Off: `Sentry.close()`; every later call is a no-op. On again: `init` again.
- Breadcrumbs and errors raised while off are dropped, not buffered.
- Stays inside `engine/core`: it receives plain callbacks, not the game's `PrivacyChoices` (engine boundary rule).

### `main.ts`

- Build `PrivacyChoices`, pass it to both drivers.
- Sentry driver is created when a DSN is available (same dev gating as now) but does nothing until enabled.
- `requestPrivacyChoices()` replaces `requestAnalyticsConsent()`; it runs only when at least one optional service is configured for this build and the player has not decided.

## 3. UI

### First-launch screen (`presentation/consent/consentGate.ts`, DOM overlay)

- Shown before Phaser starts, after fonts and localisation are ready.
- Content: title, one short paragraph, policy link (if configured), buttons "Reject all" / "Accept all" with equal size and weight, "Options" toggle that reveals one switch per configured service (default off) and "Save choices".
- Only services present in this build are listed (web: diagnostics only).
- Any choice resolves the promise and the game continues.

### Settings and `PrivacyDialog` (Phaser)

- `SettingsDialog`: replace the conditional UMP row with an always-visible "Privacy ›" row.
- New `presentation/dialogs/PrivacyDialog.ts` following the existing dialog style and `dialogInput` helpers:
  - switches for analytics and diagnostics (only those configured),
  - "Ads ›" row opening UMP, only when `AdsPort.privacyOptionsRequired()`,
  - "Your ID" shortened (first and last 4 characters) with a Copy button (`navigator.clipboard`, silent failure shows nothing),
  - policy link (if configured).
- Toggling writes to `PrivacyChoices`; drivers react through `onChange`.

## 4. Localisation

About 14 new `privacy_*` keys in all ten locales (en-US, es, pt-BR, fr, de, ja, ko, zh-CN, id, vi): title, intro, accept all, reject all, options, save, analytics label and description, diagnostics label and description, ads, your ID, copy, copied, policy link. Non-English, non-Vietnamese strings are machine-drafted and listed in `STATUS.md` for native review.

## 5. Testing

Unit (Vitest):

- `PrivacyChoices`: default off and undecided; set and persist; new userId when analytics is withdrawn; corrupt or missing storage; listeners fire and unsubscribe.
- GA driver with a fake SDK: no load before consent; `configureUserId` before `initialize`; disable stops submission and clears the store; re-enable behaviour.
- Sentry driver with a fake SDK: no `init` before consent; `close` on disable; re-`init` on enable; calls while off are no-ops.
- Consent gate (DOM): reject all, accept all, options with one switch, only configured services shown, policy link hidden without URL.
- `PrivacyDialog` and Settings row: follow `tests/dialogsInput.test.ts`.
- Existing tests that relied on the old consent key are updated.

Manual (evidence for the policy):

- Web and Android: network traffic before any choice, after "Reject all", after "Accept all", after switching each off in Settings. Expect no GameAnalytics or Sentry requests when off.

## Out of scope

- Ads personalisation choices beyond UMP.
- A "Delete data on this device" button.
- Writing the Privacy Policy v2 (follows this work).
