# Booking Strategy — Phase 7 Stage 11

**Source:** `BookingStrategyContract` · rollback / retry / provider abstraction hints

## Strategy hints

| Hint | Role |
|------|------|
| `prepare_only` | Preparation architecture only |
| `never_execute` | Must not execute bookings |
| `never_call_providers` | Must not contact providers |
| `multi_provider_abstract` | Abstract flight/hotel/activity/transport/future |

## Rollback hints

`compensate_planned_steps` · `close_session_clean` · `preserve_audit_trail`

## Retry hints

`retry_transient_planned` · `backoff_placeholder` · `max_attempts_placeholder`

## Provider abstraction

| Contract | Defaults |
|----------|----------|
| `BookingProviderAbstractionContract` | providerKinds listed; `wired: false` |

## Auditability

| Contract | Defaults |
|----------|----------|
| `BookingAuditContract` | auditHints listed; `persisted: false` |

Strategies/rollback/retry are declarative only — no execution in this stage.
