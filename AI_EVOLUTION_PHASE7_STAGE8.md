# AI Evolution — Phase 7 Stage 8

## Travel Search Orchestrator (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.search_orchestrator` |
| Default | **OFF** |
| Depends on | `brain.travel_planning` |
| Package | `src/lib/orchestration/travelSearchOrchestrator/` |
| Distinct from | Sprint 24 `brain.search` |
| Provider calls / HTTP / SDKs / Runtime / LLM | **Not wired** |

See `AI_SEARCH_ORCHESTRATOR.md`, `AI_SEARCH_PIPELINE.md`, `AI_SEARCH_SCHEMA.md`, `AI_PROVIDER_ABSTRACTION.md`, `AI_SEARCH_RANKING.md`, `AI_SEARCH_VALIDATION.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run arch:circular` | Pass |
| `npm run test:run` | Pass — **2933** tests (270 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/251  
Do not merge.
