# Budget & Pricing — Performance Report (Sprint 9)

**Branch:** `cursor/budget-pricing-intelligence-7518`  
**Draft PR:** [#273](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/273)  
**Generated:** 2026-07-25  

---

## Bundle impact

| Chunk | Sprint 8 (#272) | Sprint 9 (#273) |
|---|---|---|
| ChatPage | 139.20 kB | **139.20 kB** (unchanged) |
| agent-impl | 236.90 kB | **239.03 kB** (+~2.1 kB gate/import; budget deferred) |
| integrationBudgetPricing | — | **17.21 kB** (lazy chunk) |

Performance score target **≥ 90** maintained. Budget pricing loads via `deferredLoaders` only when the flag is ON.

---

## Runtime budgets (staging)

| Metric | Target |
|---|---|
| Flag OFF enrich path | 0 extra work |
| Envelope + breakdown | p95 &lt; 5ms |
| Optimize 5 tiers + trade-offs | p95 &lt; 10ms |
| Full budget pricing turn | p95 &lt; 20ms |

---

## Gates

| Check | Result |
|---|---|
| lint / typecheck / arch:circular | **pass** |
| test:run | **240 files / 2774 tests** |
| build | **pass** |
| secret hygiene | **pass** |
