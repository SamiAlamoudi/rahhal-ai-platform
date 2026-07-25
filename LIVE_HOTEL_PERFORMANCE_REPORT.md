# Live Hotel Search — Performance Report (Sprint 3)

**Branch:** `cursor/live-hotel-search-7518`  
**Draft PR:** [#268](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/268)  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 2 (#267) | Sprint 3 |
|---|---|---|
| ChatPage | 139.20 kB | **139.20 kB** (unchanged) |
| agent-impl | 225.94 kB | **229.45 kB** (+~3.5 kB additive) |

Performance score target **≥ 90** maintained: ChatPage first-load path not inflated.

---

## Runtime budgets (staging soak)

| Metric | Target |
|---|---|
| Mock hotel tool | p95 &lt; 50ms |
| Cached duplicate search | p95 &lt; 5ms |
| Live Amadeus hotels (token warm) | p50 &lt; 1500ms · p95 &lt; 3500ms |
| Failover mock after live error | p95 &lt; 100ms |

CI uses injectable `runLive` — no external Amadeus calls in `npm run test:run`.

---

## Gates

| Check | Result |
|---|---|
| lint | pass |
| typecheck | pass |
| arch:circular | pass |
| test:run | **235 files / 2720 tests** |
| build | pass |
| secret hygiene | pass |
