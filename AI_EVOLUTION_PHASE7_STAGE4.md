# AI Evolution — Phase 7 Stage 4

## AI Smart Preference Extraction Engine (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.preference_extraction` |
| Default | **OFF** |
| Depends on | `brain.personalization_engine` |
| Package | `src/lib/orchestration/preferenceExtractionEngine/` |
| LLM / DB / Storage / Runtime / Recommendation execution | **Not wired** |

See `AI_PREFERENCE_EXTRACTION_ENGINE.md`, `AI_PREFERENCE_PIPELINE.md`, `AI_CONVERSATION_PREFERENCE.md`, `AI_PREFERENCE_SCHEMA.md`, `AI_PREFERENCE_CONFIDENCE.md`, `AI_PREFERENCE_VALIDATION.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run arch:circular` | Pass |
| `npm run test:run` | Pass — **2917** tests (266 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/247  
Do not merge.
