# AGENT.md — Agent & task menu

Pick an entry by the job at hand. Each entry states **when to use it**, **what to read first**, **what to do**, and **when it is done**.
General rules live in `CLAUDE.md`.

## Menu

| # | Agent | Use when |
| --- | --- | --- |
| 1 | Onboarding | New to the project and need the big picture |
| 2 | Memory / Log | Recording project status and history |
| 3 | Level author | Creating, editing or validating levels |
| 4 | Localization | Adding or fixing a language |
| 5 | Audio | Tuning sound in the Audio Lab / synth |
| 6 | Release | Building the web bundle, syncing Android, shipping |

---

## 1. Onboarding
- **Read first:** `CLAUDE.md` → `README.md` → `STATUS.md` → `CHANGELOG.md`.
- **Do:** summarize the architecture, commands and in-flight work for the user. Describe only; do not critique code.
- **Done when:** the user knows where to start.

## 2. Memory / Log (memory agent)
- **Read first:** `STATUS.md`, `CHANGELOG.md`.
- **Do:**
  - `STATUS.md` = *now*: branch, current work, next steps, blockers. Overwrite so it matches reality.
  - `CHANGELOG.md` = *history*: only add new entries at the top of `Unreleased`; never edit old entries.
  - Record only what cannot be derived from git or code (decisions, reasons, pending items).
- **Run when:** at the end of each work session or after any significant change.
- **Done when:** `STATUS.md` matches reality and `CHANGELOG.md` has the new entry.

## 3. Level author
- **Read first:** `docs/content/level-kit.md`.
- **Do:** `npm run content:new -- <id>` → edit `src/content/sources/<id>.ts` → `npm run content:author -- <id>` → `npm run content:validate`.
- **Done when:** validation is clean; the SVG preview and solver report exist in `docs/testing/levels/`.

## 4. Localization
- **Read first:** `src/localization/localizationConfig.ts` and one sample folder in `src/locales/`.
- **Do:** copy the key set from `en-US`, translate, register the locale (see the locale rule in `CLAUDE.md`), check that `LanguageSelectDialog` shows it correctly. Fact length budgets: 115 chars Latin, 80 Korean, 70 Japanese/Chinese.
- **Done when:** `npm run typecheck` and `npm test` pass; no keys are missing versus `en-US`.

## 5. Audio
- **Read first:** `src/audio-synth/README.md`.
- **Do:** tune in the Audio Lab (`/tools/audiolab.html`), render trial output with `npm run audio:author`.
- **Done when:** the `audio*` tests pass.

## 6. Release
- **Do:** `npm run build:release` → `npm run android:sync` → (in `android/`) `gradlew.bat assembleDebug`.
- **Before that:** update `CHANGELOG.md` (rename `Unreleased` to the version number) and `STATUS.md`.
- **Done when:** the build passes the release gate (`content:validate --release`).
