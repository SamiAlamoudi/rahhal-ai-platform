# Observability (Phase AI)

## Correlation IDs

- Created or accepted via `x-correlation-id`
- Helpers: `createCorrelationId`, `runWithCorrelation`, `correlationIdFromHeaders`
- Propagated through Trip Planner HTTP, booking, and ops logs

## Structured logging

`StructuredLogger` emits one JSON object per line:

- `ts`, `level`, `message`
- `correlationId`
- `domain`, `operation`
- `durationMs`, `success`
- `metadata` (PII/secret masked)

## Metrics

`OpsMetricsRegistry` counters/gauges (in-process):

| Metric | Meaning |
|---|---|
| `request.duration_ms` | HTTP / request latency |
| `planning.duration_ms` | Trip planning duration |
| `booking.duration_ms` | Booking orchestration duration |
| `ops.failures` | Classified failures |
| `ops.retries` | Retry attempts |
| `ops.cancellations` | Cancelled operations |
| `provider.*` | Live provider outcomes (Phase W) |
| `ops.rate_limited` | Rate-limit hits |

Helpers: `recordRequestDuration`, `recordPlanningDuration`, `recordBookingDuration`, `recordFailure`, `recordRetry`, `recordCancellation`.

## Health monitoring

| Probe | Checks |
|---|---|
| Liveness | process up |
| Readiness | env, payment mock, API, database, queue, cache, live payments off |
| Health | readiness + failure pressure |

Edge: `supabase/functions/ops-health`.

## Tracing (OpenTelemetry hooks)

- `startSpan` / `withSpan` / `setTracerProvider`
- Default provider is no-op (zero dependency)
- `RecordingTracerProvider` available for tests
- Spans always carry `correlation.id`

## Error taxonomy

Categories:

1. Validation
2. Authentication
3. Authorization
4. Provider
5. Timeout
6. Internal

`classifyError()` maps unknown errors → taxonomy via `AppError`.

## Circuit breaker

`createOpsCircuitBreaker()` — closed → open → half-open for future provider integrations (Phase W adapters keep their own breaker today).

## Rate limiting

`checkDomainRateLimit(domain, key)` — in-memory sliding window; no paid rate-limit service.

## Related

- `docs/PRODUCTION_READINESS.md`
- `docs/INCIDENT_RESPONSE.md`
- `src/lib/ops/**`
