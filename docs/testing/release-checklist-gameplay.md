# Release checklist — Gameplay & stability (GAME)

Branch: `feature/release-checklist-localization`. Last reviewed: 2026-10-23.
Status: `OK-code` = verified by reading code only · `TODO-device` · `N/A` · `OPEN`. No device evidence is collected yet; scope is locked first.

## Summary

| ID | Item | Status | Finding |
| --- | --- | --- | --- |
| GAME-01 | Core loop | TODO-device (scope question) | Loop exists; there is **no lose state and no currency reward**. |
| GAME-02 | Interruptions | OK-code / TODO-device | Background/resume handled; in-level state is not persisted if the OS kills the app. |
| GAME-03 | Network loss | N/A (offline game) | No network or ads code. Only a boot-time asset retry exists. Offline behaviour still worth one video. |
| GAME-04 | Safe area | OK-code / TODO-device | Cutout + insets handled in 3 scenes; dialogs and bottom gesture area need device checks. |

## GAME-01 — Core loop

What the code does: Menu → Level select map → Play (drag/rotate pieces, time bar with 3 stars) → result card (stars, time, best) → next level or back to the map. Endless gate after 1-10. Progress is saved per level; Settings has reset.

Points to confirm with the leader before recording the video:
1. **"Thua" (lose)**: no fail condition found in `PlayScene`/`TimeBar`; time only decides how many stars you get. Is "no lose state" the intended design? If yes, state it in the checklist note.
2. **"Nhận thưởng" (reward)**: the only reward is the star rating on the result card (and unlocking the next level/chapter). No coins or items. Confirm this counts.
3. Chapters 4/5 show "Coming soon" on the map (waiting for the leader); chapter 2 Endless gate was removed. The video should end at a sensible point (last playable level), not look stuck.

Device video (fresh install): launch → loading → menu → Start → play level 1-1 with the tutorial → win → result card → Next → a few levels → open map → open Settings → change language → back → quit and relaunch (progress kept). Also try: restart a level, pause menu → resume/restart/quit, hardware Back on every screen (Back on the menu exits the app), win the last playable level of each chapter (is the end of content clear?), 1-10 → Endless gate → run → exit.

## GAME-02 — Interruptions

Code: `lifecycle.ts` + `main.ts`. On `appStateChange` inactive the game does `director.skip()`, pauses music and sounds and `game.loop.sleep()`; on resume `game.loop.wake()` and audio resume. The level clock only advances in `tick`, so time does not run while asleep. The board state stays in memory, so returning to the app continues the same level. Android activity handles `configChanges` itself (no activity restart on rotation/theme/density) and is locked to portrait.

Gaps to check (not provable from code):
1. **Process death**: if Android kills the app in the background, an unfinished level starts over (progress is saved on completion). Acceptable? Test by "Don't keep activities" in Developer options.
2. Incoming call heads-up banner: the window may lose focus without a full pause; confirm the game doesn't keep running/lock input, and that system bars stay hidden after the call (`onWindowFocusChanged` re-hides them).
3. No explicit audio-focus handling (call/another media app): confirm music pauses and returns correctly.
4. While in the middle of a drag and the app goes to the background: the piece must not stay stuck or "held" after resuming.

Device tests (record video, mid-level each time, check state after returning): home button and app switcher; lock screen/unlock; incoming call (answer and decline) and alarm/notification shade; fold/unfold a foldable if available; low-memory kill; screen rotation attempt (locked to portrait); split screen/multi-window if the device allows; interrupt during the transition animation, during the result card, during a dialog (pause/settings/language); battery saver mode.

## GAME-03 — Network loss

Code search: no `fetch`, `XMLHttpRequest`, `WebSocket`, `navigator.onLine`, ads or billing in the runtime code. `INTERNET` permission exists only because of Capacitor. The only retry UI is the boot error screen (`bootGate.ts`, `.intro-retry-btn`) for failed startup loading, and `PlayScene.loadFailed` for a failed level load; both are local-asset errors.
Conclusion: there is nothing online to fail, so the criteria "error + Retry" and "while watching Ads" are N/A. Re-open if ads, cloud save or a remote policy page (COMP-01) are added.

One cheap video still worth recording: airplane mode on from a fresh install → everything works (all 10 languages, audio, levels), and toggling Wi-Fi/4G during play changes nothing. Also confirm the web build shows the boot retry button when an asset fails (simulate by blocking an asset in DevTools).

## GAME-04 — Safe area

Code: `MainActivity` draws edge-to-edge (`setDecorFitsSystemWindows(false)`, cutout mode `SHORT_EDGES`, system bars hidden, swipe shows them transiently). `index.html` has `viewport-fit=cover`. `designSafeArea()` reads `env(safe-area-inset-*)` once, converts it to design units, and `Menu`, `LevelSelect` and `Play` scenes apply it (`board/layout.ts` clamps it). `tests/viewport.test.ts` covers the unit conversion.

Risks to check on device:
1. Insets are **read once and cached** (`cachedSafeArea`); if the first read happens before the WebView reports insets it stays 0 for the whole session. Test cold start on a notched device.
2. Dialogs (Pause, Settings, Language picker, confirm) and toasts: only the three scenes read the safe area; check dialogs and their buttons are not under the notch or gesture bar.
3. With system bars hidden, the bottom gesture area may report an inset of 0 while a swipe-up still triggers: make sure the piece tray/bottom buttons aren't placed where the gesture starts (test dragging pieces near the bottom edge).
4. Camera cutout on a side or centre punch-hole, and rounded corners.
5. Aspect ratios: tall (20:9) and short (16:9) screens. `computeDesignView` changes the design height; check HUD, time bar and the level map header/footer.

Screenshots required (at least 2 screen sizes): one small/16:9 device without a notch and one notched or punch-hole device. For each, capture the Menu, Level select, Play (full board with tray), result card, Settings, language picker and the pause dialog.

## Test matrix (fill in when devices are chosen)

| Device | Android | Screen / ratio | Notch/cutout | Notes |
| --- | --- | --- | --- | --- |
| _TBD_ small, no notch | | | no | |
| _TBD_ notch/punch-hole | | | yes | |
| _TBD_ low-end (≤3 GB RAM) | | | | check memory kills and frame rate |
