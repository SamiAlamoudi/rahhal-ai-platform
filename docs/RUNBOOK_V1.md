# Runbook (V1)

## Symptoms → Actions

| Symptom | Check | Action |
|---------|--------|--------|
| App blank / crash | Browser console, `AppErrorBoundary` | Capture correlation id; redeploy last good build |
| Auth fails | Supabase status, env URL/anon | Fix env; `recordAuthFailure` in metrics |
| Search empty | Provider flags, rate limit, circuit | Fallback mock; open circuit cool-down |
| Booking stuck | Session resume, TransactionManager | Resume session; rollback partial |
| Docs missing | Booking document generation | Regenerate via booking snapshot |
| High latency | `ops.slow_requests`, provider latency | Scale back live providers; use cache |

## Correlation

All structured logs should include `correlationId` from `getCorrelationId()` / `withCorrelationId()`.

## Alerts

`DEFAULT_ALERT_RULES` + mock dispatcher. Wire production sink before enabling live traffic.

## Escalation

See `docs/INCIDENT_RESPONSE.md` and root `ALERTING_MATRIX.md`.
