# Maps & Live Mobility — Performance Report (Sprint 8)

**Branch:** `cursor/maps-live-mobility-7518`  
**Draft PR:** [#272](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/272)  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 7 (#271) | Sprint 8 (#272) |
|---|---|---|
| ChatPage | 139.20 kB | **139.20 kB** (unchanged) |
| agent-impl | 234.90 kB | **236.90 kB** (+~2.0 kB gate/import; maps deferred) |
| integrationMapsMobility | — | **16.08 kB** (lazy chunk) |

Performance score target **≥ 90** maintained. Maps mobility loads via `deferredLoaders` only when the flag is ON.

---

## Runtime budgets (staging)

| Metric | Target |
|---|---|
| Flag OFF enrich path | 0 extra work |
| Mock geocode + route | p95 &lt; 10ms |
| Nearby catalog | p95 &lt; 5ms |
| Live distance matrix (warm) | p95 &lt; 1500ms (when injected) |

---

## Gates

| Check | Result |
|---|---|
| lint / typecheck / arch:circular | **pass** |
| test:run | **239 files / 2764 tests** |
| build | **pass** |
| secret hygiene | **pass** |
