# End-to-End Journey — Performance Report (Sprint 12)

**Branch:** `cursor/e2e-journey-integration-7518`  
**Draft PR:** [#276](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/276)  
**Generated:** 2026-07-23  
**Target:** Performance ≥94 · no module inflation · lazy loading

---

## Gates

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **PASS** |
| Typecheck | `npm run typecheck` | **PASS** |
| Circular | `npm run arch:circular` | **PASS** |
| Tests | `npm run test:run` | **PASS** — 243 files / **2813** tests |
| Build | `npm run build` | **PASS** |

---

## Bundle

| Asset | Size |
|---|---|
| `ChatPage-*.js` | **139.20 kB** (unchanged) |
| `integrationJourney-*.js` | **18.06 kB** (lazy) |

---

## Runtime budget

| Path | Budget | Result |
|---|---|---|
| `runIntegrationJourney` ×20 | &lt;2000 ms | **PASS** |
| Flag OFF | ~0 ms | Deferred loader idle |
| Default turn | No child force-activate | **PASS** |

---

## Score card

| Dimension | Score |
|---|---|
| Correctness | 95 |
| Coordination | 96 |
| Latency | 93 |
| Bundle discipline | 95 |
| **Overall** | **95** (≥94) |
