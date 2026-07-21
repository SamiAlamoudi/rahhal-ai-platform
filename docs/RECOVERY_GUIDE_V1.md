# Recovery Guide (V1)

Use `planRecovery({ scenario })` from `src/lib/ops/production/recovery.ts`.

| Scenario | Strategy |
|----------|----------|
| `provider_unavailable` | Circuit fallback + graceful degrade |
| `provider_degraded` | Cache + retry budget |
| `provider_timeout` | Retry → DLQ |
| `partial_booking_failure` | Rollback + session resume |
| `booking_interrupted` | Booking resume |
| `document_missing` / `document_corrupt` | Document regenerate |
| `trip_inconsistent` | Trip repair (append timeline, never wipe) |
| `rate_limited` | Backoff + degrade |

Enqueue unknowns via `enqueueRecoveryFailure` → Dead Letter Queue.

Booking path already has TransactionManager retries/timeouts/idempotency — do not duplicate.
