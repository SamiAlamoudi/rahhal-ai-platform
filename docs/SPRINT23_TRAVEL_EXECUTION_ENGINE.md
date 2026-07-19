# Sprint 23 — Travel Execution Engine

Converts a Sprint 22 `TripPlan` into executable search tasks behind mock provider adapters. No live supplier or LLM APIs.

## Non-goals (strict)

- No Amadeus / Booking.com / Google Maps / OpenAI / Azure / ElevenLabs
- No changes to Sprint 19–22 behavior when `brain.execution` is OFF
- Provider interfaces only — mocks return production-shaped payloads

## Pipeline

```
Conversation
  → Brain
  → TripPlanningEngine (Sprint 22)
  → TravelExecutionEngine (Sprint 23)
  → ExecutionPlan
  → ExecutionSummary
```

Text (`planTurn`) and voice (`commitUserUtterance` + `awaitPendingExecution`) share `runIntegratedBrainPipeline` / `attachTravelExecution`.

## Task graph

```
TripPlan
  → FlightSearchTask
  → HotelSearchTask        (depends on flight)
  → TransportSearchTask    (depends on flight)
  → ActivitiesSearchTask   (depends on hotel)
  → PackageSearchTask      (depends on flight + hotel)
  → ExecutionPlan
```

Each `ExecutionTask` includes: unique id, type, priority, dependencies, status, retry count, timeout, estimated duration, metadata.

## Core types

| Type | Role |
|------|------|
| `ExecutionPlan` | Ordered task graph + state |
| `ExecutionTask` | Single search unit |
| `ExecutionResult` | Per-task outcome |
| `ExecutionSummary` | Aggregate headline + progress |
| `ExecutionState` | idle / building / running / completed / cancelled / failed / partial |
| `ExecutionProgress` | Counts + ratio + current task |

## Orchestrator features

- Sequential waves with dependency resolution
- Parallel-safe execution within a ready wave
- Cancellation via `AbortSignal`
- Retry strategy (`maxRetries`)
- Per-task timeout
- Partial success support

## Providers (mock)

`FlightProvider` · `HotelProvider` · `TransportProvider` · `ActivitiesProvider` · `PackageProvider`

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_execution` | `brain.execution` | `brain.trip_planning` |

## Debug UI

`ExecutionViewer` inside `ConversationDebugPanel` — queue, running, completed, failed, progress, dependencies, summary.

## Modules

`src/lib/brain/execution/`

## Tests

`src/lib/__tests__/travelExecutionEngine.sprint23.test.ts`
