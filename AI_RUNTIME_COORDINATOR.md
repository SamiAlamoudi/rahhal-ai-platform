# AI Runtime Coordinator — Stage 4

**Status:** Additive coordination layer · Flag `ai.runtime_coordinator` **default OFF**  
**Freeze:** Production planning · reasoning/consultant engine internals · itinerary / recommendation mutation remain untouched.

The Runtime Coordinator is responsible for **executing** consultant intelligence layers through a shared runtime. It does not change intelligence algorithms.

---

## 1. Mission stages

| Stage | Role |
|-------|------|
| Reflection | Incremental consultant memory / confidence |
| Traveler Intelligence | Behavioral traveler model |
| Planning Graph | Multi-plan graph root / branches |
| Destination Intelligence | Destination knowledge / match |
| Recommendation Intelligence | Expert recommendation package |
| Travel Strategy | Timing / budget / comfort strategy |
| Unified Consultant Response | Aggregated multi-format response |

---

## 2. Responsibilities

| Concern | Behavior |
|---------|----------|
| Execution ordering | Stable topological order from dependency graph |
| Dependency resolution | Expand prerequisites; skip dependents on failure |
| Shared context | Enrich-only stage bags (write-once) |
| Runtime cache | Session-scoped immutable result reuse |
| Lazy execution | Dynamic import of stage runners only when ON |
| Cancellation | `AbortSignal` → mark remaining cancelled |
| Timeout handling | Per-stage timeout; isolate (no retry) |
| Retry policy | Configurable `maxRetries` for non-timeout errors |
| Error isolation | Failed stage skips dependents; independent stages continue |
| Performance monitoring | Telemetry: order, durations, cache, retries, timeouts, failures |

---

## 3. Execution rules

```
requested stages
    → expand prerequisites
    → topological order
    → for each stage:
         cache hit? reuse
         else run (timeout + retry)
         on fail/timeout → skip dependents
    → attach read-only meta (never mutate plan)
```

- Run only required stages  
- Skip unnecessary engines  
- Reuse previous runtime context via cache  
- Never execute duplicate work for identical session+context hashes  

---

## 4. Feature flag & planTurn

| Flag | Default | OFF | ON |
|------|---------|-----|----|
| `ai.runtime_coordinator` | **OFF** | Production path unchanged | Coordinator runs after planning; attaches `meta.runtimeCoordinator` (+ `consultantResponse` when that stage completes) |

When the runtime flag is ON it **prefers** the coordinator path over Stage 2/3 finalize to avoid duplicate pipeline work.

---

## 5. Package layout

`src/lib/agent/orchestrator/runtime/`

| File | Role |
|------|------|
| `runtimeTypes.ts` | Contracts |
| `runtimeFeature.ts` | Flag gate |
| `runtimeDependencies.ts` | Graph + order resolution |
| `runtimeCache.ts` | Immutable result cache |
| `runtimeContext.ts` | Shared enrich-only context |
| `runtimeTelemetry.ts` | Metrics (no PII) |
| `runtimeCoordinator.ts` | Scheduler + turn enrichment |
| `index.ts` | Barrel |

---

## 6. Safety

- Read-only coordination  
- Never modifies production planning / itinerary / recommendations engines  
- Fail-open on unexpected coordinator errors in planTurn enrichment  
- Test-only `faultInject` lives at the coordinator boundary (does not touch engines)

---

## 7. Explicit non-goals

- No intelligence / scoring rewrites  
- No streaming transport yet (structure ready for future streaming)  
- No default-ON flag  
- No merge to `main`
