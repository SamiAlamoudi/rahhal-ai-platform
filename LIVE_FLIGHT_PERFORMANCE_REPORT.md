# Live Flight Search — Performance Report (Sprint 2)

**Branch:** `cursor/live-flight-search-7518`  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 1 (#266) | Sprint 2 |
|---|---|---|
| ChatPage | 139.20 kB | **139.20 kB** (unchanged) |
| agent-impl | 222.20 kB | **225.94 kB** (+~3.7 kB additive) |
| integrationFlightSearch (lazy) | — | **46.77 kB** separate chunk |

Performance score target **≥ 90** maintained: ChatPage first-load path not inflated; live bridge loads with agent/tool graph only.

---

## Runtime budgets (staging soak)

| Metric | Target |
|---|---|
| Mock conversation flight tool | p95 &lt; 50ms |
| Cached duplicate search | p95 &lt; 5ms |
| Live Amadeus (token warm) | p50 &lt; 1200ms · p95 &lt; 3000ms |
| Failover mock after live error | p95 &lt; 100ms |

CI harness uses injectable `runLive` — no external Amadeus calls in `npm run test:run`.

---

## Gates

| Check | Result |
|---|---|
| lint | pass |
| typecheck | pass |
| arch:circular | pass |
| test:run | **234 files / 2707 tests** |
| build | pass |
| secret hygiene | pass |
