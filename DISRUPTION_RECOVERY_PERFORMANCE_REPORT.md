# Disruption Recovery — Performance Report (Sprint 10)

**Branch:** `cursor/live-disruption-recovery-7518`  
**Draft PR:** _(pending)_  
**Generated:** 2026-07-23  
**Target:** Performance score ≥90 · ChatPage size stable · lazy chunk for recovery

---

## Gates (pending full run)

| Gate | Command | Expected |
|---|---|---|
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Circular | `npm run arch:circular` | PASS |
| Tests | `npm run test:run` | PASS (incl. Sprint 10) |
| Build | `npm run build` | PASS · ChatPage ~139.20 kB |
| Secret hygiene | CI / local scan | PASS |

---

## Runtime budget

| Path | Budget | Notes |
|---|---|---|
| `runDisruptionRecovery` ×20 | &lt;1500 ms wall | Unit perf assertion |
| Flag OFF | ~0 ms | Deferred loader never called |
| Live alerts | N/A | Mock provider `live=false`, empty poll |

---

## Bundle expectations

| Asset | Expectation |
|---|---|
| ChatPage | Unchanged vs Sprint 9 baseline (~139.20 kB) |
| `integrationDisruptionRecovery` | Lazy chunk via `loadIntegrationDisruptionRecovery` |

---

## Score card (to finalize after gates)

| Dimension | Score |
|---|---|
| Correctness | _pending_ |
| Regression safety | _pending_ |
| Latency | _pending_ |
| Bundle discipline | _pending_ |
| **Overall** | **≥90 target** |
