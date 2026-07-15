# Monitoring Runbook — Phase AA

## Signals

Use `collectMonitoringSnapshot()` for a point-in-time view:

| Signal | Source | Recorder |
|--------|--------|----------|
| Application availability | `checkLiveness` / `checkHealth` | `recordAppUnavailable` |
| Frontend errors | Ops metrics | `recordFrontendError` |
| Edge Function failures | Ops metrics | `recordEdgeFunctionFailure` |
| Auth failures | Ops metrics | `recordAuthFailure` |
| Database errors | Ops metrics | `recordDatabaseError` |
| Provider latency | Ops metrics | `recordProviderOutcome` |
| Provider fallback | Ops metrics | `recordProviderOutcome` |
| Circuit breaker open | Provider gauges | `recordProviderOutcome` |
| Booking failures | Ops metrics | `recordBookingFailure` |
| Payment mock failures | Ops metrics | `recordPaymentMockFailure` |
| Ticketing failures | Ops metrics | `recordTicketingFailure` |
| Notification failures | Ops metrics | `recordNotificationFailure` |
| Slow requests | Ops metrics | `recordSlowRequest` |
| Memory pressure | `estimateMemoryPressure` | snapshot field |
| Queue backlog | Ops metrics | `recordQueueBacklog` |
| DLQ growth | `getDeadLetterQueue()` | snapshot `deadLetterCount` |

## Evaluation loop

```typescript
import {
  collectMonitoringSnapshot,
  evaluateAlertRules,
  dispatchAlerts,
  getIncidentManager,
} from './lib/ops'

const snapshot = collectMonitoringSnapshot({ target: 'production', paymentProvider: 'mock' })
const alerts = evaluateAlertRules(snapshot)
await dispatchAlerts(alerts)
for (const alert of alerts.filter(a => a.severity === 'critical' || a.severity === 'high')) {
  getIncidentManager().createFromAlert(alert)
}
```

## Probes

| Probe | Endpoint / API |
|-------|----------------|
| Liveness | `checkLiveness()`, `/health.json` |
| Readiness | `checkReadiness()`, `ops-health?probe=ready` |
| Health | `checkHealth()`, `ops-health?probe=health` |

## Degradation

1. Confirm mock fallback active (`VITE_LIVE_PROVIDERS_ENABLED=false`).
2. Inspect circuit breaker snapshots (Phase W adapters).
3. Review structured logs with correlation IDs.
4. Check `evaluatePatchRelease` for rollback vs patch vs monitor.

## No paid alerting required

Default sink is `MockAlertDispatcher`. Wire `setAlertDispatcher()` to PagerDuty/Slack/email when configured — interface is `AlertSink`.
