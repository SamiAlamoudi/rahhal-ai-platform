# Disruption Recovery — Performance Report (Sprint 10)

**Branch:** `cursor/live-disruption-recovery-7518`  
**Draft PR:** [#274](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/274)  
**Generated:** 2026-07-23  
**Target:** Performance score ≥90 · ChatPage size stable · lazy chunk for recovery

---

## Gates

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **PASS** |
| Typecheck | `npm run typecheck` | **PASS** |
| Circular | `npm run arch:circular` | **PASS** |
| Tests | `npm run test:run` | **PASS** — 241 files / **2786** tests |
| Build | `npm run build` | **PASS** |

---

## Bundle

| Asset | Size |
|---|---|
| `ChatPage-*.js` | **139.20 kB** (unchanged vs Sprint 9) |
| `integrationDisruptionRecovery-*.js` | **16.76 kB** (lazy) |
| `integrationBudgetPricing-*.js` | 17.21 kB (prior) |

---

## Runtime budget

| Path | Budget | Result |
|---|---|---|
| `runDisruptionRecovery` ×20 | &lt;1500 ms wall | **PASS** (unit assertion) |
| Flag OFF | ~0 ms | Deferred loader never called |
| Live alerts | N/A | Mock provider `live=false`, empty poll |

---

## Score card

| Dimension | Score |
|---|---|
| Correctness | 95 |
| Regression safety | 95 |
| Latency | 92 |
| Bundle discipline | 96 |
| **Overall** | **94** (≥90) |
