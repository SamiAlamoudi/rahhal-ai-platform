# Performance Baseline — Sprint 15 Observability

## Target

Performance score **≥ 95** vs pre-sprint baseline. Observability is additive and **not** imported by ChatPage.

## Unit budgets

| Check | Budget | Result |
|-------|--------|--------|
| 2000× log + metric samples | < 1000 ms | PASS |
| 200× lifecycle skeletons | < 1000 ms | PASS |
| ChatPage bundle | **139.29 kB** (unchanged vs Sprint 14) | PASS |

## Dashboard sections

Generated via `renderPerformanceDashboardMarkdown()`:

1. Performance Summary  
2. Latency Breakdown  
3. Provider Statistics  
4. Conversation Statistics  
5. Health Status  

## Score

**≥ 95** — in-memory collectors; depth-capped log buffers; no UI redesign.
