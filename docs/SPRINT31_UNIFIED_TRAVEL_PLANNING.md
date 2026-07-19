# Sprint 31 — Unified Travel Planning Engine

First complete end-to-end travel planning coordinator for Rahhal. **Additive only** — `UnifiedTravelPlanner` combines existing Sprint 22–30 engines behind one conversation-first API without replacing them.

## Non-goals (strict)

- Do not replace TripPlanningEngine, AITripOrchestrator, SearchAggregationEngine, or provider adapters
- Do not enable live HTTP by default
- Do not change Sprint 1–30 behavior when `brain.unified_travel_planner` is OFF
- Do not proactively ask for passport / nationality

## Architecture

```
User request
  → UnifiedTravelPlanner.planTrip
       ├─ Context extraction (conversation + overrides)
       ├─ AITripOrchestrator (Sprint 27) — optional
       │     └─ Conversation Memory (Sprint 28)
       │     └─ TripPlanning → Execution → Search Aggregation
       ├─ Flight search (mock / destination-aware foundation)
       ├─ Hotel Provider Foundation (Sprint 30) — multi-provider failover
       ├─ Flight ↔ hotel matching
       ├─ Optimize by budget / duration / preferences / loyalty / context
       └─ Ranked UnifiedTravelPlanOption[] + cost + confidence + itinerary
```

| Component | Responsibility |
|-----------|----------------|
| `UnifiedTravelPlanner` | End-to-end coordinator (`planTrip`) |
| Context extraction | Destination, dates, travelers, budget, airlines, hotels, loyalty |
| Missing-info gate | One minimal follow-up before search |
| Provider search | Flights + Hotelbeds/Expedia/Booking Connectivity sandbox |
| Optimize / rank | Weighted scoring → multiple itinerary options |
| Cost estimate | Flights + hotels + activities + transport + taxes/fees |

## Optimization factors

| Factor | Role |
|--------|------|
| `budget` | Fit vs trip budget |
| `duration` | Prefer shorter flight times |
| `preferences` | Airline / hotel brand match |
| `loyalty` | Alfursan / Skywards / etc. alignment |
| `conversation_context` | Completeness of slots from chat |
| `flight_hotel_match` | Cabin/star/cancellation consistency |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `unified_travel_planner` | `brain.unified_travel_planner` | `brain.trip_orchestrator` |

Optional:

- `brain.context_memory` — seed from working memory
- `providers.hotel_foundation` — explicit hotel foundation gate (planner uses sandbox hotels by default when enabled)

## Modules

`src/lib/brain/unifiedTravel/`

## Integration

| Layer | How |
|-------|-----|
| AITripOrchestrator | Injected / default `runOrchestrator` for planning+search+memory |
| Conversation Memory | Working-memory prefs → context merge |
| Hotel Provider Foundation | `searchHotelsForOrchestrator` + preference boost |
| Flight foundation | Destination-aware mock flight adapter (sandbox-safe) |
| Search Aggregation | Consumes orchestrator recommendation confidence/reasoning |

## Output

Each `UnifiedTravelPlanOption` includes:

- Matched flight + hotel
- Day-by-day itinerary sketch
- Total trip cost estimate
- Confidence score + factor breakdown
- Preference / loyalty alignment reasons

`UnifiedTravelPlanResult` returns ranked `plans`, `topPlan`, `alternatives`, optional single follow-up, and provider diagnostics.

## Tests

`src/lib/__tests__/unifiedTravelPlanner.sprint31.test.ts`

Coverage: feature flag, context extraction, missing follow-ups, budget optimization, multi-option ranking, hotel foundation multi-provider path, orchestrator/memory integration, conversation-driven preference/loyalty planning, flag-off compatibility.
