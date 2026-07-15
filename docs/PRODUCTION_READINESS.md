# Production Readiness (Phase X)

Rahhal is prepared for a **controlled staging release**. Live payments remain frozen (`VITE_PAYMENT_PROVIDER=mock`). Live travel providers stay **off** unless explicitly enabled via feature flags after Edge secrets are configured.

## Scope

| Area | Library / artifact |
|------|--------------------|
| Structured logging | `src/lib/ops/logging/*` |
| Canonical errors + boundaries | `src/lib/ops/errors/*`, `AppErrorBoundary` |
| Health / ready / live | `checkHealth/Readiness/Liveness`, `public/health.json`, `supabase/functions/ops-health` |
| Security policy | headers (`public/_headers`, Vite middleware), CORS helpers, rate limits, env validation |
| Reliability | idempotency, retry/timeout budgets, graceful shutdown, DLQ, consistency checks |
| Performance | budgets, dedupe, TTL cache, slow-call / long-task logging |
| CI gates | `.github/workflows/ci.yml` |

## Safe defaults

1. `VITE_PAYMENT_PROVIDER=mock`
2. `VITE_LIVE_PROVIDERS_ENABLED=false`
3. Per-domain provider adapters default to mock / unavailable without secrets
4. Aggregation uses `priority_fallback` → mock on live failure
5. No provider secrets in `VITE_*` (validated at startup / readiness)

## Staging gate

Follow `docs/STAGING_CHECKLIST.md` and `docs/RELEASE_CHECKLIST.md`. Incident playbooks live in `docs/INCIDENT_RESPONSE.md`. Security baseline in `docs/SECURITY.md`. Env catalog in `docs/ENVIRONMENT_VARIABLES.md`.

## Explicit non-goals (this phase)

- No new user-facing product features
- No UI redesign / rebrand
- No enabling live Moyasar / card capture
- No changes to ProviderAdapter contracts beyond ops wrapping already introduced in Phase W
