# Maps & Live Mobility — Performance Report (Sprint 8)

**Branch:** `cursor/maps-live-mobility-7518`  
**Draft PR:** _(pending)_  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 7 (#271) | Sprint 8 |
|---|---|---|
| ChatPage | 139.20 kB | _(pending build)_ |
| agent-impl | 234.90 kB | _(pending build)_ |
| integrationMapsMobility | — | _(pending build)_ |

Performance score target **≥ 90**. Maps mobility loads via `deferredLoaders` only when the flag is ON.

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
| lint / typecheck / arch:circular | _(pending)_ |
| test:run | Sprint 8 unit: **9 passed**; full suite _(pending)_ |
| build | _(pending)_ |
| secret hygiene | _(pending)_ |
