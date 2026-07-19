# Sprint 33 — Travel Execution Engine (Production Foundation)

Converts a **selected** `UnifiedTravelPlanOption` into executable sandbox bookings. Orchestrates flight/hotel reservation ports without embedding provider-specific supplier logic.

> **Naming note:** Sprint 23 also has a `TravelExecutionEngine` under `src/lib/brain/execution/` that builds **search tasks** from a `TripPlan`. Sprint 33 lives at `src/lib/execution/` and performs **booking reservation** orchestration. Different packages, different flags.

## Non-goals (strict)

- Do not rewrite AITripOrchestrator, UnifiedTravelPlanner, Conversation Memory, Conversation UI, or Hotel/Flight provider foundations
- Do not duplicate provider search / planning / booking-session UI logic
- Do not change Sprint 1–32 behavior when `brain.travel_execution_engine` is OFF
- Do not call live Amadeus / Booking.com / Hotelbeds / Expedia booking APIs

## Architecture

```
Selected UnifiedTravelPlanOption
  → TravelExecutionEngine
       ├─ BookingSession (sessionId, tripId, conversationId, pricing, travelers)
       ├─ ExecutionCoordinator
       └─ BookingPipeline
            ├─ Validate request
            ├─ Reserve flight (FlightReservationPort → sandbox / provider id)
            ├─ Reserve hotel  (HotelReservationPort → Booking.com / Hotelbeds / Expedia / mock)
            ├─ BookingReferenceGenerator
            ├─ BookingStateMachine
            ├─ Rollback (cancel flight hold if hotel fails)
            ├─ ExecutionSummary + ExecutionResult
            ├─ ExecutionEvents / ExecutionAudit / ExecutionMetrics
            └─ ExecutionLogger
```

| Module | Responsibility |
|--------|----------------|
| `TravelExecutionEngine` | Public API + feature-flag gate |
| `ExecutionCoordinator` | Session lifecycle (create / execute / retry / cancel) |
| `BookingSession` | In-memory session store |
| `BookingPipeline` | Validate → reserve → references → persist → summary → events |
| `BookingStateMachine` | CREATED → … → COMPLETED / FAILED / CANCELLED / ROLLBACK |
| `BookingContext` | Context from selected itinerary |
| `BookingReferenceGenerator` | Booking / trip / execution / confirmation refs |
| `ExecutionSummary` / `ExecutionResult` | Confirmation payload for callers |
| `ExecutionEvents` | ExecutionStarted, FlightReserved, HotelReserved, … |
| `ExecutionAudit` / `BookingTimeline` | Persist history |
| `ExecutionMetrics` / `ExecutionLogger` | Observability |
| `ExecutionRetryPolicy` | Bounded retries on reserve attempts |
| `providers/sandboxReserve` | Sandbox flight/hotel reserve ports (provider-id aware) |

## State machine

`CREATED` → `VALIDATED` → `FLIGHT_RESERVED` → `HOTEL_RESERVED` → `COMPLETED`

Also: `FAILED`, `CANCELLED`, `ROLLBACK`. Hotel-only plans may skip `FLIGHT_RESERVED`; flight-only may complete after flight. Retry resets `FAILED` → `CREATED`.

## Rollback

- Hotel reserve fails after a successful flight hold → `ROLLBACK` + cancel flight if `cancellable`
- Flight reserve fails → abort immediately (no hotel attempt)

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `travel_execution_engine` | `brain.travel_execution_engine` | `brain.conversation_ui` |

Helper `isTravelExecutionEngineEnabled()` also requires the upstream brain chain (`brain.enabled` … `brain.conversation_ui`).

Distinct from Sprint 23 `brain.execution` (search-task engine).

## Modules

`src/lib/execution/`

## Integration

| Engine | Role |
|--------|------|
| UnifiedTravelPlanner | Supplies selected `UnifiedTravelPlanOption` |
| Hotel Provider Foundation | Provider ids (Booking Connectivity, Hotelbeds, Expedia Rapid, mock) |
| Flight provider registry | Provider id on selected flight leg |
| Conversation UI / Memory | conversationId + traveler context (no duplicated logic) |
| Sprint 23 brain execution | Unchanged search-task engine |

## Tests

`src/lib/__tests__/travelExecutionEngine.sprint33.test.ts`

Coverage: booking session, pipeline, state machine, retry, rollback, summary, metrics, audit, events, mock providers, feature flag.
