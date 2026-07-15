# Incident Response

## Severity

| Level | Example | Response |
|-------|---------|----------|
| SEV-1 | Data leak, payment secret exposure, auth bypass | Immediate page; disable traffic / rotate secrets |
| SEV-2 | Staging/prod outage, cascading provider failures | Mitigate with flags; deepen investigation |
| SEV-3 | Elevated error rate, single provider degraded | Feature-flag / fallback; schedule fix |
| SEV-4 | Cosmetic / docs | Ticket |

## First 15 minutes

1. Capture **correlation IDs** from structured logs / user reports.
2. Check `ops-health` (live/ready/health) and SPA `/health.json`.
3. Confirm `VITE_PAYMENT_PROVIDER` is still `mock` for staging.
4. Disable live providers: `VITE_LIVE_PROVIDERS_ENABLED=false` (redeploy) — mocks remain.
5. If secrets suspected in client bundle or logs: rotate immediately; scrub logs.

## Provider incidents

- Prefer Phase W **priority_fallback** + circuit breaker (auto mock).
- Inspect ops metrics: `provider.failures`, `provider.fallback`, `provider.circuit_open`.
- Inspect dead-letter queue utilities for failed async work.

## Payment incidents

- Do **not** enable Moyasar during freeze.
- If mock payment path fails: record `payment.mock_failures` metric; rollback SPA build if needed.

## Communications

- Internal: status note with severity, impact, mitigation, ETA.
- External: only when user-facing booking/payment outcomes are affected.

## Post-incident

- Timeline, root cause, blast radius, follow-ups.
- Update checklists / feature-flag matrix if defaults change.
