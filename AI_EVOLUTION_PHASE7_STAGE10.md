# AI Evolution — Phase 7 Stage 10

## Offer Decision Engine (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.offer_decision_engine` |
| Default | **OFF** |
| Depends on | `brain.travel_recommendation` |
| Package | `src/lib/orchestration/travelOfferDecisionEngine/` |
| Distinct from | `brain.travel_recommendation` · `brain.personalization_engine` · `ai.recommendation_engine` |
| Booking / Providers / Payments / Runtime / LLM / HTTP / DB | **Not wired** |

See `AI_OFFER_DECISION_ENGINE.md`, `AI_OFFER_PIPELINE.md`, `AI_OFFER_SCHEMA.md`, `AI_OFFER_STRATEGY.md`, `AI_OFFER_SCORING.md`, `AI_OFFER_RANKING.md`, `AI_OFFER_EXPLANATION.md`, `AI_OFFER_VALIDATION.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pending |
| `npm run typecheck` | Pending |
| `npm run arch:circular` | Pending |
| `npm run test:run` | Pending |

Draft PR: pending  
Do not merge.
