# Release checklist — Compliance (COMP)

Branch: `feature/release-checklist-localization`. Last reviewed: 2026-10-22.
Status: `OK-code` = verified in code only · `TODO-device` · `TODO-console` · `N/A` · `OPEN` = needs a decision or a missing asset.
Evidence is not collected yet; scope is locked first.

## Summary

| ID | Item | Status | Finding |
| --- | --- | --- | --- |
| COMP-01 | Terms & Privacy Policy links | **OPEN – blocker** | No Privacy Policy / Terms link or URL anywhere in the app, repo or docs. |
| COMP-02 | Tutorial (clear, skippable, not repeated) | OK-code / TODO-device | Skip button exists and the seen flag is persisted. Needs a fresh-install video. |
| COMP-03 | Paywall info | N/A | No IAP/subscription/paywall in the app. |
| COMP-04 | Age rating questionnaire | TODO-console | Answers must be prepared from the facts below. |
| COMP-05 | In-app account deletion | N/A | No login or account. |

## COMP-01 — Terms & Privacy Policy (blocker)

Code search (`src`, `index.html`, `capacitor.config.ts`, `README`/`docs`): no `privacy`, `terms`, `policy` or any external URL except audio credits (`suno.com` in `audioManifest.ts`). No dialog, button or Settings entry opens a link. The Settings dialog only has sound/haptics, language and "reset progress".

Even with no IAP and no account, both stores still require a public Privacy Policy URL (Play Console: App content → Privacy policy; App Store Connect: Privacy Policy URL), and the Play Data safety form must match it.

To do:
1. Decide who hosts the policy and Terms (public web page) and get the final URLs from the owner/leader.
2. Add a Privacy Policy / Terms entry in Settings that opens the URL (needs a way to open an external browser, e.g. `@capacitor/browser`; not installed now — `package.json` has only `app`, `core`, `haptics`) plus localized labels in all 10 locales (new keys in `types.ts`).
3. Enter the same URL on the store listing.
4. Evidence: public URLs + screenshot of the link opening from inside the app + screenshot of the Store field.

Not done yet: nothing in code was changed for this item.

## COMP-02 — Tutorial

- Skip: `TutorialCoach.ts` renders a `tutorial_skip` button, localized in all locales. `TutorialController.skip()` ends the tutorial and calls `markSeen()`.
- Not repeated: `createTutorial` returns `null` when the seen flag is set. The flag is stored per level in its own storage key (`tutorialStorageKey`), falls back to memory if storage fails. Tutorials exist for level `1-1` (drag) and `3-1` (rotation); the campaign mode only.
- Device checks:
  1. Fresh install → record video: start → tutorial → finish (or Skip) → back to menu → relaunch → tutorial does not appear again.
  2. Skip on step 1 and on a later step → never shown again, including after force-stop.
  3. Clear app data → tutorial shows again.
  4. Settings → reset progress: note whether the tutorial returns (the seen flag is a separate key; confirm whether this is intended).
  5. Level `3-1` rotation tutorial: same checks (needs chapter 3 access).
  6. A first-time player (not a team member) understands the main flow without help.
  7. Tutorial text in a few languages (ties in with LOC-04).

## COMP-03 — Paywall

N/A: no purchase, subscription, billing or ads code or dependency. Re-open this item if monetization is added.

## COMP-04 — Age rating

Facts from the code to answer the questionnaires truthfully:
- Puzzle game, no violence, no gambling, no user-generated content, no chat/social features, no ads, no IAP, no login.
- Permissions: only `INTERNET` (Capacitor default); the game works offline.
- Data: progress, settings and the optional local playtest log (`nozvi.playtest.v1`) stay on the device (`localStorage`); no network telemetry found. `LocalPlaytestRecorder` is not wired into any scene in `src`, to be confirmed with the leader.
- Third-party content: audio credits point to suno.com (check the licence allows commercial release).
- Target audience / "designed for children" and the final answers are a product decision.

To do (console, not possible from the repo): complete Play Console IARC questionnaire and App Store Connect age rating; screenshot the resulting ratings; make the Data safety form say "no data collected" only if that stays true.

## COMP-05 — Account deletion

N/A: no sign-in, no account creation. Re-open if accounts or cloud save are added. Settings → "reset progress" only clears local data.

## Extra checks (outside the checklist, found while reading)

- `capacitor.config.ts` `appName` and `strings.xml` `app_name` are still "Mirror" (display name was reverted earlier on purpose, confirm for release).
- `versionName 1.0.0`, `versionCode 3`, `targetSdkVersion 36`: confirm they meet the current Play requirements at upload time.
