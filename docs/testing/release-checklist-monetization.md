# Release checklist — Monetization & analytics (MON)

Branch: `feature/release-checklist-localization`. Last reviewed: 2026-10-23.
Status: `N/A` = feature does not exist · `OPEN` = to be handled later by the owner. No device evidence is collected.

## Summary

| ID | Item | Status | Finding |
| --- | --- | --- | --- |
| MON-01 | Production Ad Unit IDs | N/A | No ads SDK (AdMob/AppLovin) in `package.json`, Gradle files, manifest or `src`. |
| MON-02 | `app-ads.txt` | N/A | Only needed with ads. No file in `public/`. Add it (on the developer website, not the app) if ads are introduced. |
| MON-03 | Consent form (UMP) | N/A | No ads or personal-data SDK. Re-open together with MON-01 and COMP-01. |
| MON-04 | Restore Purchases | N/A | No IAP, no purchase UI (see COMP-03). |
| MON-05 | Play Billing acknowledge | N/A | No billing library, so no transactions to acknowledge or refund. |
| MON-06 | Analytics events | **OPEN** | GameAnalytics is integrated for the Android build (progression + design events for level start / complete / abandon); `app_open`, `tutorial_complete`, `level_achieved` still do not exist. On-device check passed 2026-10-26 for campaign start, complete and abandon; endless mode not checked yet. |

## MON-06 detail

- `application/telemetry.ts` defines local events (`session_start`, `level_start`, `level_complete`, `ftue_step_*`, ...) and `infrastructure/playtestRecorder.ts` stores them in `localStorage` (`nozvi.playtest.v1`). Nothing is sent off the device, and I found no scene calling `record(...)` (to confirm).
- None of `app_open`, `tutorial_complete`, `level_achieved`, `af_purchase`, `ad_impression` exists in the code. The closest local events: `session_start`, `ftue_step_done`, `level_complete`.
- `android/build.gradle` includes the `google-services` classpath and `app/build.gradle` applies it only if `google-services.json` exists. This is the Capacitor template default; there is no such file, so Firebase is not active.
- Decision for the owner (to handle later): either add an analytics SDK and map the events above (needs a Firebase/AppsFlyer account, a privacy policy update, and the Data safety form), or mark MON-06 as not applicable for v1.0.0. Adding analytics changes COMP-01/COMP-04 answers (data collected) and may need a consent flow.
- 2026-10-26: GameAnalytics (JS SDK 5.0.0) is wired through `AnalyticsPort`. Active only in the native app with `VITE_GA_GAME_KEY` and `VITE_GA_SECRET_KEY` set at build time; first launch shows a placeholder consent screen and the SDK loads only after the player agrees. Open: real consent UI, COMP-01 / Data Safety update, and an on-device check that events appear in the GameAnalytics dashboard.

## Re-open triggers

Ads → MON-01..03 + COMP-01/04. IAP/subscription → MON-04/05 + COMP-03 (paywall) + Store Restore wording. Analytics SDK → MON-06 + COMP-01 + Data safety.
