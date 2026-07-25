# Health Checks

## Surfaces

`HealthMonitor.endpointPayloads()` exposes:

| Path | Check |
|------|-------|
| `/api/health` | Aggregate report |
| `/api/health/application` | App liveness |
| `/api/health/providers` | Provider statuses |
| `/api/health/database` | DB probe (deferred — no Supabase call) |
| `/api/health/cache` | Cache hit ratio |
| `/api/health/memory` | Heap / pressure flag |
| `/api/health/cpu` | Coarse CPU signal |
| `/api/health/disk` | Disk (SPA: unknown) |
| `/api/health/queue` | Queue |

## Status values

`healthy` · `degraded` · `unhealthy` · `unknown`

## Alert rules (definitions only)

- High latency (P95)
- Provider failures
- Authentication failures
- Conversation failures (low completion rate)
- Memory pressure
- Unexpected restart

No PagerDuty / Slack / email integration in this sprint.
