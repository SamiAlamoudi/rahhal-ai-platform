# End-to-End Journey — Performance Report (Sprint 12)

**Branch:** `cursor/e2e-journey-integration-7518`  
**Draft PR:** _(pending)_  
**Generated:** 2026-07-23  
**Target:** Performance ≥94 · no module inflation · lazy loading

---

## Gates (pending full run)

| Gate | Command | Expected |
|---|---|---|
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Circular | `npm run arch:circular` | PASS |
| Tests | `npm run test:run` | PASS (incl. Sprint 12) |
| Build | `npm run build` | PASS · ChatPage ~139.20 kB |

---

## Runtime budget

| Path | Budget |
|---|---|
| `runIntegrationJourney` ×20 | &lt;2000 ms |
| Flag OFF | ~0 ms |
| Default turn | No child force-activate |

---

## Score card (to finalize)

| Dimension | Score |
|---|---|
| Correctness | _pending_ |
| Coordination | _pending_ |
| Latency | _pending_ |
| Bundle discipline | _pending_ |
| **Overall** | **≥94 target** |
