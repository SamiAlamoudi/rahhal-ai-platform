# Production Baseline — Sprint 19 (Pre-GA)

## Latency (soak simulation)

| Metric | Target | Status |
|--------|--------|--------|
| Average step latency | low ms-class sim | PASS |
| P95 | < 5s | PASS |
| P99 | < 5s | PASS |

## Resources

| Metric | Notes | Status |
|--------|-------|--------|
| Peak memory | heap samples during soak | PASS |
| CPU estimate | synthetic load units | PASS |
| Timeouts | injected + measured rate | PASS |

## Bundle / startup

| Metric | Value | Status |
|--------|------:|--------|
| ChatPage | **139.28 kB** | PASS (no growth) |
| Lazy loading | ChatPage voice / Results / agent impl | PASS |
| Cold start | small entry chunk + vendors | PASS |
| Warm start | route code-split | PASS |

## Security baseline

`npm audit --audit-level=high` → 0 high (react-router@8.3.0 override retained from Sprint 17).
