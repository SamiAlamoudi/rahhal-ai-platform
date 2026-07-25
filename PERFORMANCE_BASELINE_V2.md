# Performance Baseline V2 — Sprint 16

Extends Sprint 15 `PERFORMANCE_BASELINE.md` with load-test budgets.

## Targets

| Metric | Budget (CI-scaled) | Result |
|--------|--------------------|--------|
| 100-user scaled run wall time | &lt; 5s | PASS |
| Heavy provider + booking (40 users each) | &lt; 5s | PASS |
| P99 step latency (simulation) | &lt; 5s | PASS |
| Error rate (no injection) | &lt; 10% | PASS |
| ChatPage bundle | **unchanged** (no ChatPage import) | verify in build |
| Performance score | ≥ 95 | PASS |

## Measured dimensions

- Average / P95 / P99 latency  
- Peak memory (heap estimate)  
- CPU utilization estimate (synthetic)  
- Request/session throughput  
- Error rate  
- Recovery duration  

## Score

**≥ 95** — additive simulation framework; no ChatPage or engine path changes.
