# Sprint 14 — Booking Confirmation Engine + Supplier Adapter Foundation

Provider-independent confirmation lifecycle on top of Sprint 13 Booking Records.

## Goals

- Confirmation statuses: **pending → confirming → confirmed | failed | cancelled**
- Confirmation events + timestamps + production references (`RHL-CONF-*` / supplier PNR)
- Supplier adapter ports (Amadeus active; Duffel / Travelport / Sabre stubs)
- Confirmation UI with loading / pending / confirmed / failed / retry
- Timeline: Booking Created → Waiting for Supplier → Supplier Confirmed → Ticket Pending → Completed
- Concierge: confirmed? / show confirmation / booking reference / booking status

## Architecture

```
BookingSession (SoT)
  → ConfirmationEngine (lifecycle + metadata.bookingConfirmation)
  → SupplierBookingAdapter (Amadeus / future providers)
  → Booking Confirmation UI + BookingTimeline
  → Concierge replies (agent layer, Sprint 9 voice)
```

- Engine **never** imports Amadeus HTTP clients.
- Adapters are swappable via registry; confirmation engine stays provider-blind.
- Booking Records remain projections; confirmation state syncs onto session metadata + status.

## Package map

```
src/lib/bookingConfirmation/
  types.ts
  confirmationReference.ts
  confirmationTimeline.ts
  confirmationEngine.ts
  confirmationConcierge.ts
  index.ts

src/lib/supplierAdapters/
  types.ts
  registry.ts
  stubs.ts
  amadeus/amadeusBookingConfirmationAdapter.ts
  index.ts

src/components/bookingConfirmation/
  BookingTimeline.tsx
  ConfirmationStatusBadge.tsx

src/pages/BookingConfirmationPage.tsx  → /booking/confirmation/:sessionId
```

## Feature flags

| ID | Alias | Depends on |
|----|-------|------------|
| `ui.booking_confirmation` | booking_confirmation | `ui.booking_history` |
| `ui.supplier_adapter` | supplier_adapter | `ui.booking_confirmation` |
| `ui.booking_timeline` | booking_timeline | `ui.booking_confirmation` |

## Concierge intents

| Intent | Examples |
|--------|----------|
| `booking_confirmed` | “Has my booking been confirmed?” |
| `show_confirmation` | “Show confirmation” |
| `booking_reference` | “What is my booking reference?” |
| `booking_status` | “What is the booking status?” |

## Tests

`src/lib/__tests__/bookingConfirmation.sprint14.test.ts`

## Frozen

Sprints 9–13 remain intact (additive wiring only).
