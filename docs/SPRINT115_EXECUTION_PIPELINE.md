# Sprint 115 — Unified AI Execution Pipeline (Production)

**Type:** Additive orchestration layer (`src/lib/agent/pipeline`)  
**Position:** Single-call coordinator over existing engines

## Architecture

```
Conversation understanding
        ↓
Memory Engine
        ↓
Preference resolution
        ↓
Search planning
        ↓
Live Flight Search (or prefetched offers)
        ↓
Live Hotel Search (or prefetched offers)
        ↓
Decision (pass-through confidence — engine unmodified)
        ↓
Trip Builder
        ↓
Itinerary Engine
        ↓
Response Composer
        ↓
Concierge
        ↓
Final response
```

This sprint does **not** rewrite engines. Default stage handlers call public APIs only (`runMemoryEngine`, `runTripBuilder`, `runItineraryEngine`, `runResponseComposer`, `runConcierge`). Flight/hotel stages reuse prefetched offers; live provider adapters are injectable.

Distinct from Sprint 113 `ai.orchestrator` (`src/lib/agent/orchestrator`).

## Modules

| File | Role |
|------|------|
| `PipelineRunner.ts` | Feature-flag gate + entry (`runUnifiedExecutionPipeline`) |
| `ExecutionPipeline.ts` | Sequential stage execution, timeout, retry, recovery |
| `PipelineStages.ts` | Stage ids, contracts, helpers |
| `PipelineContext.ts` | Shared mutable context |
| `PipelineResult.ts` | Aggregated result shape |
| `PipelineMetrics.ts` | Per-stage + aggregate metrics |
| `PipelineLogger.ts` | Structured logging |
| `PipelineValidator.ts` | Input validation |
| `PipelineExplainer.ts` | Human-readable run explanation |
| `feature.ts` / `index.ts` | Flag + barrel |

## Pipeline flow

Every stage returns `status`, `durationMs`, `warnings`, `errors`, `metadata`, plus optional `artifact` / `confidence`.

Supports:

- continue on warning
- recoverable failures
- partial execution
- retry hooks
- per-stage timeout
- metrics + structured logs

## Feature flag

`ai.execution_pipeline` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `runUnifiedExecutionPipeline` returns `{ enabled: false }` — legacy unchanged |
| ON | Full stage sequence runs |

## Verify

```bash
npm run pipeline:verify
```

Runs lint, typecheck, build, and Sprint 115 tests.
