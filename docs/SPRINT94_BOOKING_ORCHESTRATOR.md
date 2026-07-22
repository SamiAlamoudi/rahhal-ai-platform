# Sprint 94 — Live Booking Orchestrator

**Type:** Additive booking workflow (`src/core/booking` + agent bridge)  
**Depends on:** Sprint 90 Provider Readiness (Retry · CircuitBreaker · error taxonomy) · approved bookable Trip (Sprint 93 shape)

## Goal

Convert an approved Unified Trip into an **executable booking workflow** ready for production providers — without redesigning existing engines.

## Architecture

```
Unified Trip (Sprint 93) ──toBookableTrip──▶ BookableTrip
        ↓
Validate (price / availability / currency / travelers / timeout / provider health)
        ↓
Reservation Plan
        ↓
Flight Reservation (live-ready hold)
        ↓
Hotel Reservation (placeholder)
        ↓
Transfer Reservation (placeholder)
        ↓
Insurance Reservation (placeholder)
        ↓
Booking Summary + Audit
```

Does **not** modify: Constitution, Conversation, Decision, Learning, Price Intelligence, Unified Trip, Amadeus Sandbox, Provider Readiness, Alpha Experience, Itinerary Refinement, or existing `bookingExecution` modules.

## Modules (`src/core/booking`)

| Module | Role |
|--------|------|
| `BookingOrchestrator` | End-to-end workflow |
| `BookingPlan` | Reservation steps from Trip |
| `BookingSession` | Session lifecycle + rollback state |
| `BookingState` | Pending → … → Completed transitions |
| `BookingExecutor` | Step execution + placeholders |
| `BookingValidator` | Pre-flight checks |
| `BookingRecovery` | RetryPolicy + CircuitBreaker reuse |
| `BookingAudit` | Structured event trail |
| `BookingSerializer` | Session / summary JSON |

## Booking states

Pending · Started · Waiting · Confirmed · PartiallyConfirmed · Retrying · Cancelled · Expired · Completed

## Feature flag

`booking.orchestrator` (default **ON**)

Verify: `npm run booking-orchestrator:verify`

## Agent bridge

`runLiveBookingOrchestrator` — flag-gated entry that returns session, summary, audit, and meta.

## Known limits

- Hotel / transfer / insurance reservations are **placeholders** this sprint
- Flight path is production-ready hold simulation (provider adapter wiring in later sprints)
- Payment capture is signaled via `paymentRequired` — not charged here

## Testing

`src/lib/__tests__/bookingOrchestrator.sprint94.test.ts` — session, states, validation, executor, recovery/rollback, audit, serialization, E2E flow, feature flag.
