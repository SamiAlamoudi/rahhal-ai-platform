# AI Evolution — Phase 7 Stage 11

## Travel Booking Orchestrator (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.booking_orchestrator` |
| Default | **OFF** |
| Depends on | `brain.offer_decision_engine` |
| Package | `src/lib/orchestration/travelBookingOrchestrator/` |
| Distinct from | `booking.orchestrator` · `src/lib/booking` · `src/core/booking` |
| Booking execution / Providers / Payments / Runtime / LLM / HTTP / DB | **Not wired** |

See `AI_BOOKING_ORCHESTRATOR.md`, `AI_BOOKING_PIPELINE.md`, `AI_BOOKING_SCHEMA.md`, `AI_BOOKING_LIFECYCLE.md`, `AI_BOOKING_STRATEGY.md`, `AI_BOOKING_VALIDATION.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run arch:circular` | Pass |
| `npm run test:run` | Pass — **2945** tests (273 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/254  
Do not merge.
