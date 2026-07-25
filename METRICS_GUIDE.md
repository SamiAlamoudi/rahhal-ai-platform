# Metrics Guide

## Collected signals

| Metric | Source |
|--------|--------|
| Requests/sec | Rolling 60s request timestamps |
| Average / P95 / P99 latency | Latency ring buffer |
| Provider failures | `recordProviderFailure` |
| Provider timeouts | `recordProviderTimeout` |
| Conversation completion rate | started / completed |
| Cache hit ratio | hits / (hits+misses) |
| Feature flag usage | `recordFeatureFlagUsage` |

## Rules

- Metrics labels never include secret values
- Collectors are in-memory; no external TSDB yet
- Enable via `observability.platform` or `{ enabled: true }` in tests

## Usage

```ts
import { createMetricsCollector } from '@/lib/observability'

const m = createMetricsCollector({ enabled: true })
m.recordRequest(120)
console.log(m.snapshot())
```
