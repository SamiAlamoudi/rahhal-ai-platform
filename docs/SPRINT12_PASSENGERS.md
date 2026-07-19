# Sprint 12 — Passenger Management & Booking Flow

Allow travellers to complete passenger information after selecting a flight (Sprint 11) and before booking review.

## Goals

- Passenger module for adults, children, and infants matching itinerary counts
- Full passenger form (identity, passport, contact, optional preferences)
- Friendly validation (age rules, passport expiry, email/phone, country codes)
- Booking summary (flight, passengers, fare/taxes/fees/total, concierge)
- Persist passengers + pricing + booking payload on the booking session (resume after refresh)
- Concierge summaries via Sprint 9 consultant voice (not hardcoded UI stubs)

## Architecture

```
Select Flight (Sprint 11)
  → BookingSession
  → /booking/passengers (flag ui.passenger_booking_flow)
       lib/passengers (slots, validate, fare, persist, concierge summary)
       components/passengers (forms, summary card, banner)
  → persist passengers on session item metadata
  → /booking/review
```

- **Provider-agnostic:** `src/lib/passengers` never imports Amadeus/Duffel/etc.
- **Additive:** Sprint 9–11 packages untouched except ResultsPage navigate target + optional `travelerSummary` on `updateBookingItem`.
- **Feature flag:** `ui.passenger_booking_flow` (depends on `ui.flight_results_experience`)

## Package map

```
src/lib/passengers/
  types.ts
  countries.ts
  ageRules.ts
  validatePassenger.ts
  createPassengerSlots.ts
  fareBreakdown.ts
  persistPassengers.ts
  passengerSummary.ts
  index.ts

src/components/passengers/
  PassengerForm.tsx
  PassengerFormList.tsx
  BookingSummaryCard.tsx
  PassengerConciergeBanner.tsx

src/pages/PassengerBookingPage.tsx
```

## Session metadata (Sprint 12)

Flight booking item `metadata` gains:

- `passengers` — full passenger records
- `passengersComplete` — boolean
- `pricing` — fare / taxes / fees / grandTotal
- `bookingPayload.passengers` + `sessionId`
- `sprint: 12`

Local draft key: `rahhal_passenger_draft_v1:<sessionId>` for mid-form resume.

## Age rules

Relative to departure date:

| Type | Age |
|------|-----|
| Infant | &lt; 2 |
| Child | 2–11 |
| Adult | ≥ 12 |

## Tests

`src/lib/__tests__/passengers.sprint12.test.ts`

## Frozen

Sprints 9–11 remain intact (additive wiring only).
