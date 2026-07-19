# Sprint 25 — Production Booking Flow (MVP)

Connects existing engines into one end-to-end booking journey. **No new engine** — orchestration only via `BookingFlowController`.

## Non-goals (strict)

- Do not create a new planning / search / booking engine
- Do not duplicate BookingOrchestrator, TripPlanning, Execution, or Search Aggregation logic
- Do not enable live payment / supplier APIs
- Do not change Sprint 1–24 behavior when `ui.booking_flow` is OFF

## Pipeline

```
Conversation
  → Requirement extraction
  → Planning (TripPlanningEngine)
  → Execution (TravelExecutionEngine)
  → Search Results (SearchAggregationEngine)
  → User Selection
  → Booking Session (BookingOrchestrator)
  → Booking Review
  → Ready for Payment (prepareBookingPayment)
```

## BookingFlowController

Responsible **only** for orchestration:

- Stage progression
- Selection apply / partial section replace
- Session bind + restore
- Review model assembly
- Conversation edit detection (cheaper hotel, business class, extra nights)
- Brain memory sync after changes
- Payment navigation prep (reuses `prepareBookingPayment`)

## State preservation

- Flow snapshot in `localStorage` (`rahhal_booking_flow_v1:`)
- Booking session remains SoT via existing `BookingOrchestrator` + persistence
- Refresh restores flow + session
- Back navigation keeps `bookingSessionId` / `bookingFlowId` in location state
- Conversation context stays available via Brain memory sync

## Booking Review sections

Flights · Hotels · Transport · Activities · Packages · Travelers · Dates · Price summary · Budget comparison · Warnings — each editable without restarting the full plan.

Partial edits:

- Changing hotel does **not** recreate flights
- Changing flight preserves hotel when still compatible (kind-scoped replace)

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `booking_flow` | `ui.booking_flow` | `ui.passenger_booking_flow` |

## Modules

`src/lib/bookingFlow/` · `src/components/bookingFlow/`

## Tests

`src/lib/__tests__/bookingFlow.sprint25.test.ts`
