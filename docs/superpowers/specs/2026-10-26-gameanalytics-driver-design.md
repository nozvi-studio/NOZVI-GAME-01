# GameAnalytics driver + consent placeholder — design

Branch: `feature/game-analytics` (cut from `feature/sentry-crash-reporting` @ `54a854a`). Date: 2026-10-26.

## Goal

Send level-progress analytics (from `LevelTracker`) to GameAnalytics on the **Android** build released first in Vietnam this week. Web keeps the console driver in dev only. Consent is a minimal placeholder the owner will replace.

## Decisions (agreed with the owner)

- Platform: Android (Capacitor WebView), one GameAnalytics game. Web later, with its own game key.
- Approach A: npm `gameanalytics` loaded with a dynamic `import()` and initialised in the background, same pattern as `sentryCrashDriver.ts`. No native plugin.
- Consent: a first-launch screen asks the player to agree to share play data; the game is not entered until they press **Agree**. The choice is stored. The real UI and wording come later from the owner.
- `level_abandon` maps to progression `Fail` plus a design event.
- Keys come from `.env.local` (git-ignored): `VITE_GA_GAME_KEY`, `VITE_GA_SECRET_KEY`. Never committed, never pasted in chat.

## Components (all new, `infrastructure/` unless noted)

1. `gameAnalyticsDriver.ts` — `createGameAnalyticsDriver(config, load?, consent?)` returns an `AnalyticsDriver`.
   - `config`: `{ gameKey, secretKey, build }` (`build` = `APP_VERSION`).
   - `load`: defaults to `import('gameanalytics')`; tests pass a fake `GameAnalyticsLike`.
   - Does not load or initialise the SDK until consent is granted (initialisation itself may send session events).
2. `analyticsConsent.ts` — stores and reads the consent flag through `getSafeStorage()` (key `nozvi.analytics.consent.v1`); `isAnalyticsConsentGranted()` and `grantAnalyticsConsent()`.
3. `presentation/consent/consentGate.ts` — **placeholder**: a plain DOM overlay with one question, one **Agree** button, one language (Vietnamese). `requestAnalyticsConsent(): Promise<void>` resolves when the player agrees; resolves immediately if already stored. Replaceable without touching the driver.
4. `main.ts` — builds the driver when both keys are present **and** `Capacitor.isNativePlatform()`. When the driver is active, `startGame` awaits `requestAnalyticsConsent()` before creating the Phaser game. Otherwise the console driver (dev only) or nothing, as today.
5. `vite-env.d.ts` — declare the two env vars.

The consent gate is shown only when the GameAnalytics driver is active, so dev and web are unaffected.

## Event mapping

| `TelemetryEvent` | GameAnalytics |
| --- | --- |
| `level_start` | `addProgressionEvent(Start, "chapter<N>", levelId)` |
| `level_complete` | `addProgressionEvent(Complete, "chapter<N>", levelId, score = stars)` + design events `Complete:Moves:<levelId>` (value `moveCount`), `Complete:Resets:<levelId>` (value `resetCount`) |
| `level_abandon` | `addProgressionEvent(Fail, "chapter<N>", levelId)` + design event `Abandon:<levelId>` (value `resetCount`) |
| any other type | ignored |

Rules from the SDK docs: `score` is an integer on `Complete`/`Fail`; design `eventId` has at most 5 segments of at most 32 characters. Endless uses `chapter<N>` and `endless-<chapter>-<number>`. `levelId` is never a custom dimension (20-value limit, risk of being blocked).

## Data flow

```
LevelTracker -> analytics.track -> queue (2 s batches) -> driver.track(event)
  consent not granted -> drop (never buffered)
  SDK not ready / failed -> drop (initInBackground timeout 8 s, safely swallows errors)
  ready -> map to SDK calls
```

First granted `track`: `import()` the SDK, `configureBuild(build)`, `initialize(gameKey, secretKey)`. Commands wait for init and run in order.

## Error handling

SDK hang, network failure or blocked request never reaches the game: `initInBackground` plus the existing `safely` wrapper. Missing either key means no driver is created.

## Out of scope

Replay detection, custom dimensions, resource events, error events to GameAnalytics (Sentry owns errors), a Decline button, the final consent wording and its localisation, Privacy Policy and Data Safety text (COMP-01), a web game key.

## Open items for the owner

- Confirm with whoever owns compliance that a mandatory Agree gate (no Decline) is acceptable for the Vietnam release and Google Play.
- Confirm the SDK works inside the Capacitor WebView on a real device (the SDK docs say nothing about WebView).
- If "gamecode" is not the GameAnalytics secret key, check the key names in the game settings.

## Tests

Fake SDK, no network:
- the three mappings (progression levels, `score`, design events, segment length <= 32);
- no consent -> SDK not loaded, nothing sent;
- consent granted -> initialised once, then events sent in order;
- SDK load or call throws -> nothing propagates;
- unknown event types ignored;
- consent store reads and writes through a fake storage and survives unavailable storage.

The DOM gate is a placeholder and gets no test beyond "resolves immediately when consent is stored".

## Findings from the installed SDK (gameanalytics 5.0.0, checked 2026-10-26)

- The ESM build exports the named namespace `gameanalytics` (holding `GameAnalytics` and `EGAProgressionStatus`); its `default` export is a command function. The loader reads `imported.gameanalytics`.
- `addProgressionEvent(status, progression01, progression02, progression03, score, customFields, mergeFields)`: `score` is the fifth parameter. `EGAProgressionStatus`: Start = 1, Complete = 2, Fail = 3.
- `configureBuild` must be called before `initialize` (the driver does this).
- Importing the module has side effects: it calls its own `init()`, reads `navigator`, probes `localStorage` with a temporary write, starts a 100 ms interval and registers a `beforeunload` handler. Because the driver imports the SDK only after consent, none of this runs before the player agrees. Whether that import-time `init()` sends anything over the network is not confirmed: check on a device.

## Changes after the first on-device run (2026-10-26)

- The first run showed progression events, design events and a user event arriving in GameAnalytics, but no `Start` before the first completion. The SDK drops (does not queue) events sent before its session has started, and the driver used to initialise it lazily on the first event. Fix: `warmUp()` initialises the SDK right after consent, and the driver polls `isReady()` (200 ms steps, 10 s limit) before sending.
- `Complete:Moves` / `Complete:Resets` carried no level id, so levels could not be compared (design events cannot be filtered by progression). They now end with `:<levelId>`. Events already collected under the old ids stay under the old ids.
- `isReady()` calls the SDK's `isSdkReady`, which is `private` in the installed typings but present at runtime. The package is pinned to 5.0.0; re-check this call when upgrading.
- Without the keys the SDK chunk is still emitted by the build but is only fetched through the dynamic `import()` inside the loader, which never runs.
