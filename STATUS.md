# STATUS

> The *current* state of the project. Overwrite when things change; history lives in `CHANGELOG.md`.
> Last updated: 2026-10-22

## Branches
- Working on: `feature/ai-onboarding-memory-agent-i18n` (cut from `release/v1.0.0`)
- Release branch: `release/v1.0.0` · Main: `main` · Development: `dev`

## Version
- `1.0.0` (per `package.json`)

## In progress
- [x] AI onboarding setup: `CLAUDE.md`, `AGENT.md`
- [x] Project log setup: `STATUS.md`, `CHANGELOG.md`
- [ ] Add new languages (currently en-US, id, ja, pt-BR, vi)

## Next steps
- Target locale set from the system list: en, es, pt-BR, fr, de, ja, ko, zh-CN, id, vi.
- Missing versus the current set: es, fr, de, ko, zh-CN (5 locales).

## Blockers / open questions
- The request said "4 new languages", but the target list yields 5 missing locales (es, fr, de, ko, zh-CN). Confirm the scope.
- The list says `en`; the code uses `en-US`. Confirm whether to rename or keep `en-US` as the fallback.
