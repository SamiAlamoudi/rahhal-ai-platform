# Sprint 27 — AI Trip Orchestrator

Central coordinator for the Rahhal travel planning journey. **No new planning / search / booking engine** — `AITripOrchestrator` wires existing Sprint 19–26 components behind one conversation-first service.

## Non-goals (strict)

- Do not create a new Trip Planning, Search Aggregation, Booking, or Provider engine
- Do not duplicate Search Aggregation or BookingFlowController business logic
- Do not enable live HTTP by default (`VITE_LIVE_PROVIDERS_ENABLED` stays false)
- Do not change Sprint 1–26 behavior when `brain.trip_orchestrator` is OFF

## Architecture

```
User conversation
  → Intent extraction (IntentClassifier)
  → OrchestratorExecutionPlan (flights / hotels / activities / transport / packages)
  → runIntegratedBrainPipeline
       ├─ TripPlanningEngine (Sprint 22)
       ├─ TravelExecutionEngine + provider adapters (Sprint 23 / 26)
       └─ SearchAggregationEngine (Sprint 24)
  → Optional BookingFlowController (Sprint 25)
  → Aggregated response + metrics + logs
```

Provider calls remain adapter-based (`createExecutionProviders`). Real / mixed / mock modes are unchanged and still gated by `brain.real_providers` + Phase W live flags.

## Responsibilities

| Concern | Implementation |
|---------|----------------|
| Conversation-first workflow | `AITripOrchestrator.runTurn` |
| Travel intent | `extractTravelIntentFromConversation` |
| Execution plan | `buildOrchestratorExecutionPlan` (domains → task types) |
| Provider execution | Existing `TravelExecutionEngine` adapters |
| Aggregation | Existing `aggregateSearch` |
| Booking | Existing `BookingFlowController` (optional) |
| Retry / timeout | Orchestrator-level wrap around the pipeline |
| Structured logging | `createOrchestratorLogger` |
| Execution metrics | `createOrchestratorMetricsCollector` |
| Caching | TTL cache of complete aggregated turns |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_trip_orchestrator` | `brain.trip_orchestrator` | `brain.search` |

Optional connections:

- `ui.booking_flow` — attach booking journey after search
- `brain.real_providers` — use real/mixed execution providers (Sprint 26)

## Modules

`src/lib/brain/orchestrator/`

## Tests

`src/lib/__tests__/aiTripOrchestrator.sprint27.test.ts`
