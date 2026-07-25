# AI Evolution — Phase 6 Stage 4

## AI Decision Engine (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.decision_engine` |
| Default | **OFF** |
| Depends on | `brain.planning_engine` |
| Package | `src/lib/orchestration/decisionEngine/` |
| Decision execution / LLM / Runtime / Booking / Maps | **Not wired** |

See `AI_DECISION_ENGINE.md`, `AI_DECISION_PIPELINE.md`, `AI_SCORING_ENGINE.md`, `AI_RECOMMENDATION_ARCHITECTURE.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run arch:circular` | Pass |
| `npm run test:run` | Pass — **2881** tests (257 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/238  
Do not merge.
