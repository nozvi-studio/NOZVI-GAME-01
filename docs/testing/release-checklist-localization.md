# Release checklist — Localization (LOC)

Branch: `feature/release-checklist-localization` (cut from `release/v1.0.0`). Last reviewed: 2026-10-22.

Status: `OK-code` = verified in code/tests only · `TODO-device` = needs on-device evidence · `N/A` · `OPEN` = waiting for a decision.
Evidence is not collected yet: screenshots/video are deferred. Scope is locked first.

## Decisions (2026-10-22)

- The device language is **ignored on purpose** (`LocaleResolver.resolve()` = saved choice, else `en-US`). A device in Vietnamese, German or any other language opens in English; the player picks a language in Settings. `matchDeviceTag()` is unused by the app (covered by unit tests only).
- A language outside the 10 supported ones therefore also shows English.
- No IAP/paywall/ads exist in the app, so LOC-05 is N/A.
- The Chapter 2 Endless gate is removed (not finished). Chapters 4 and 5 ("Coming soon" map labels) stay as is, pending the leader's answer.

## Checklist

| ID | Item | Status | Verified by | Evidence to attach |
| --- | --- | --- | --- | --- |
| LOC-01 | Unsupported device language falls back to English | OK-code / TODO-device | `LocaleResolver`, `tests/localeResolver.test.ts` | Video/screenshot: device set to a language NOT in the list (Italian, Russian, Thai, Arabic, Hindi — not German, it is supported) → fresh install opens in English |
| LOC-02 | 10 languages listed, switchable in-app | OK-code / TODO-device | `localizationConfig.ts`, `LanguageSelectDialog`, Settings | Screenshot: Settings → language picker showing all 10; relaunch keeps the choice |
| LOC-03 | No placeholder / "Coming Soon" / debug / untranslated text | TODO-device (see open points) | Key parity script: common 78/78, game 118/118 in all 10 locales, no empty values | Screenshot per language: menu, level select, tutorial, result card, Settings, reset-confirm dialog, toasts. There is no paywall/IAP screen |
| LOC-04 | Long text does not overflow (de, es, fr, pt-BR, id, vi; also ja/ko/zh-CN wrapping) | TODO-device | `tests/cjkWrap.test.ts`, `cjkFontStack.test.ts` (no layout test for long Latin text) | Screenshot of the busiest screens per language (see device tests) |
| LOC-05 | Price/date/number formats per locale | N/A | No IAP; no `Intl`/`toLocale*` in `src`; time shown as `m:ss` only | — |

## Open points for LOC-03

1. ~~Chapter 1 gate showed "Coming Soon" while locked.~~ Fixed 2026-10-22: it now shows the new `gate_locked` label ("Locked", translated in all 10 locales).
2. `map_coming_soon` for chapters 4/5 — waiting for the leader.
3. Values identical to English that may be untranslated: `de` `btn_start`, `btn_reset`, `level_prefix`, `level_badge_label`; `fr` `chapters.2`–`chapters.4`; `id` `level_prefix`, `level_badge_label`; `es`/`pt-BR` `tutorial_step_label`. Most are probably valid loanwords; ask a native speaker.
4. es, fr, de, ko, zh-CN are machine drafts (see `STATUS.md`) and need native review.

## Extra device tests (not covered by unit tests)

Run on a real Android device or emulator, with a debug build (`npm run android:sync`).

1. **Fresh install, device in Vietnamese** → app opens in English (decision above).
2. **Fresh install, device in an unsupported language** → English (LOC-01).
3. **Fresh install, device in each supported language** (de, es, fr, ja, ko, zh-CN, pt-BR, id) → still English, no crash.
4. **Switch language mid-session** from Settings on: Menu, Level Select, Play (HUD + tutorial step), Result card → all text updates without restart; no stale text.
5. **Persistence**: pick a language, force-stop, relaunch → the choice is kept. Clear app data → back to English.
6. **Longest text per language**: Settings dialog, reset-confirm dialog, tutorial steps, result card, level-locked toast (`toast_level_locked`), chapter names/taglines on the map, menu buttons. Check no overlap, clipped or overflowing text, nothing outside the button. Prioritise de, fr, es, pt-BR, id.
7. **CJK glyphs** (ja, ko, zh-CN): no tofu boxes; Han characters use the right regional glyphs; line wrapping is sane. No CJK webfont is bundled, so this depends on the device's system fonts — test on at least two devices/OEMs.
8. **Font scale / display size**: system font size at maximum, then re-check item 6 on the 2–3 worst languages.
9. **Small screen and landscape/notch** (safe area): check the language picker (10 rows) fits and scrolls if needed.
10. **Offline / airplane mode**: language switch works (all bundles are in-app).
11. **Map after the Chapter 2 gate removal**: after clearing 2-15 no gate appears and nothing breaks; chapter 1 gate still opens after 1-10 and starts an endless run.
12. **Android app name**: launcher label — `strings.xml` `app_name` is still "Mirror" (not a LOC item; confirm it is intended for release).
13. **`index.html` `lang`**: changed from `vi` to `en` on 2026-10-22 (default language is English). Confirm nothing regresses (font fallback, TalkBack).
14. **Chapter 1 gate label**: before clearing 1-10 it reads "Locked" in every language and fits in its badge (check de "Gesperrt", id "Terkunci", fr "Verrouillé").
15. **Native review**: not available, so the machine-drafted translations ship unreviewed; keep this as a known risk in the release notes.

## Quick non-device check

- Set a language without a device: DevTools → Application → Local Storage → `nozvi.locale` = `de`, reload (web dev server `npm run dev`).
- Clear the key to test the default (English).
