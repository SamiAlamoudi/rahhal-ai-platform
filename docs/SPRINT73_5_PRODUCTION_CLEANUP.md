# Sprint 73.5 — Main Branch Production Cleanup

**Type:** Cleanup only (no features, no engine/business-logic changes)

## Goal

Convert `main` from CI-green to **production-clean**: remove dead/orphan application modules and synchronize documentation through Sprint 73.

## Removed

- `src/components/brain/**` — unused Sprint 19 debug UI
- `src/components/voice/**` — unused Sprint 18 presentational chrome
- Unused hooks: `useConversationBrain`, `useConversationMemory`, `useTravelContext`, `useVoiceConversation`, `useVoiceEvents`, `useVoiceState`
- Unused barrels: `src/integrations/providers/index.ts`, `googleMaps/index.ts`, `openWeather/index.ts`

## Preserved (intentionally)

- `src/lib/brain/**`, `src/lib/voiceConversation/**`, Chat voice path
- Provider Runtime / Flight Search / Hotel Search engines (unchanged)
- `src/domains/**` documented DDD façades (public API map; not dead product UI)
- Parallel engine helpers (rank/dedupe/pagination) — layered, not byte-duplicates

## Documentation synchronized

- `docs/CHANGELOG_V1.md`, `docs/RELEASE_NOTES_V1.md`, `docs/SYSTEM_STATUS.md`, `docs/API_STATUS.md`, `docs/ROADMAP_POST_V1.md`
- Root release notes redirected to canonical V1 docs
- `AI_ARCHITECTURE.md`, Sprint 18/19 historical notes updated
- `docs/MAIN_BRANCH_AUDIT.md` — post-cleanup PASS audit

## Validation

`npm run lint` · `typecheck` · `test:run` · `build` · `arch:circular`
