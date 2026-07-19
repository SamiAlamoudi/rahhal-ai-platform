# Sprint 36 — Universal Cancellation & Refund Policy Engine

Centralized policy engine that normalizes provider cancellation rules, quotes refunds, executes cancellations safely, and explains outcomes in conversation.

## Non-goals

- Do not rewrite payments, execution, trip management, or provider search stacks
- Do not embed live airline/hotel SDKs — adapters normalize policy payloads only
- Money movement remains in Sprint 34 `PaymentOrchestrator.refund`
- Trip lifecycle updates reuse Sprint 35 `PostBookingService`

## Architecture

```
Conversation / My Trip
  → PolicyEngine.quote / executeCancellation
       ├─ PolicyNormalizer → ProviderPolicyAdapters (flight/hotel/car/activity/visa/insurance)
       ├─ CancellationValidator
       ├─ RefundCalculator + RefundTimelineEstimator
       ├─ Provider cancel (success | fail → rollback + audit)
       ├─ PaymentOrchestrator.refund (Sprint 34)
       ├─ PostBookingService refund/cancel sync (Sprint 35)
       ├─ RefundStatusTracker (policy cases)
       ├─ AuditLogger + PolicyMetrics
       └─ Notifications (requested / approved / rejected / completed / timeline)
```

## Normalized policy model

Refundable · Refund % · Penalty · Taxes refundable/non-refundable · Provider fee · Platform fee · Cancellation deadline · Refund timeline · Special conditions · Provider notes

## Partial cancellation

`full_booking` · `flight_only` · `hotel_only` · `car_only` · `activity_only` · `one_passenger` · `one_room` · `return_flight_only`

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.refund_policy_engine` | **OFF** | `brain.trip_management` |

## Modules

`src/lib/refunds/`

## Tests

`src/lib/__tests__/refundPolicyEngine.sprint36.test.ts`
