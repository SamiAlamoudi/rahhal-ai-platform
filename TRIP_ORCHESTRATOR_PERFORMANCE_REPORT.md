# Trip Orchestrator — Performance Report (Sprint 4)

**Branch:** `cursor/ai-trip-orchestrator-7518`  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 3 (#268) | Sprint 4 |
|---|---|---|
| ChatPage | 139.20 kB | **139.20 kB** (unchanged) |
| agent-impl | 229.45 kB | **230.62 kB** (+~1.2 kB gate/import; orchestrator deferred) |

Performance score target **≥ 90** maintained. Orchestrator loads via `deferredLoaders` only when flag ON.

---

## Runtime budgets (staging)

| Metric | Target |
|---|---|
| Flag OFF enrich path | 0 extra work |
| Orchestrator with prefetched tool offers | p95 &lt; 20ms |
| Parallel mock flight+hotel | p95 &lt; 80ms |
| Parallel live (Amadeus warm) | p50 &lt; 2000ms · p95 &lt; 4000ms |

---

## Gates

| Check | Result |
|---|---|
| lint / typecheck / arch:circular | pass |
| test:run | **236 files / 2732 tests** |
| build | pass |
| secret hygiene | pass |
