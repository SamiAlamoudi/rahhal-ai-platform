# Live Trip Companion — Performance Report (Sprint 7)

**Branch:** `cursor/live-trip-companion-7518`  
**Draft PR:** _(pending)_  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 5 (#270) | Sprint 7 |
|---|---|---|
| ChatPage | 139.20 kB | _(pending build)_ |
| agent-impl | 232.98 kB | _(pending build)_ |
| integrationTripCompanion | — | _(pending build)_ |

Performance score target **≥ 90**. Companion loads via `deferredLoaders` only when the flag is ON on an in-trip ask / disruption path.

---

## Runtime budgets (staging)

| Metric | Target |
|---|---|
| Flag OFF enrich path | 0 extra work |
| Session + timeline annotate | p95 &lt; 10ms |
| Replan cascade | p95 &lt; 15ms |
| Full companion turn (mock plan) | p95 &lt; 25ms |

---

## Gates

| Check | Result |
|---|---|
| lint / typecheck / arch:circular | _(pending)_ |
| test:run | Sprint 7 unit: **11 passed**; full suite _(pending)_ |
| build | _(pending)_ |
| secret hygiene | _(pending)_ |
