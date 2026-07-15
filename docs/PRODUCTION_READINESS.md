# Production Readiness (Phase X + Phase AI)

Rahhal is prepared for a **controlled staging release**. Live payments remain frozen (`VITE_PAYMENT_PROVIDER=mock`). Live travel providers stay **off** unless explicitly enabled via feature flags after Edge secrets are configured.

## Scope

| Area | Library / artifact |
|------|--------------------|
| Structured logging | `src/lib/ops/logging/*` |
| Canonical errors + taxonomy | `src/lib/ops/errors/*`, `production/errorTaxonomy.ts` |
| Health / ready / live | `checkHealth/Readiness/Liveness` (+ API/DB/queue/cache), `public/health.json`, `ops-health` Edge |
| Security policy | headers, CORS, rate limits, env validation, payload sanitization |
| Reliability | idempotency, retry policies, timeouts, graceful shutdown, DLQ, consistency, circuit breaker |
| Centralized config | `src/lib/ops/production/appConfig.ts` |
| Live capability flags | `live.flights/hotels/activities/transport/payments` (all OFF) |
| Tracing hooks | `src/lib/ops/production/tracing.ts` (no-op OTel by default) |
| Metrics | request/planning/booking duration, failures, retries, cancellations |
| Performance | budgets, dedupe, TTL cache, slow-call / long-task logging |
| CI gates | `.github/workflows/ci.yml` |
| Runbooks | `DEPLOYMENT.md`, `CONFIGURATION.md`, `OBSERVABILITY.md` |

## Safe defaults

1. `VITE_PAYMENT_PROVIDER=mock`
2. `VITE_LIVE_PROVIDERS_ENABLED=false`
3. `VITE_LIVE_FLIGHTS_ENABLED=false` / hotels / activities / transport / payments
4. Per-domain provider adapters default to mock / unavailable without secrets
5. Aggregation uses `priority_fallback` → mock on live failure
6. No provider secrets in `VITE_*` (validated at startup / readiness)
7. OpenTelemetry hooks registered but idle unless a provider is injected

## Staging gate

Follow `docs/STAGING_CHECKLIST.md` and `docs/RELEASE_CHECKLIST.md`. Incident playbooks live in `docs/INCIDENT_RESPONSE.md`. Security baseline in `docs/SECURITY.md`. Env catalog in `docs/ENVIRONMENT_VARIABLES.md`.

## Explicit non-goals

- No new user-facing product features
- No UI redesign / rebrand
- No enabling live Moyasar / card capture
- No changes to RecommendationEngine or ItineraryEngine logic
- No breaking API / database contract changes
