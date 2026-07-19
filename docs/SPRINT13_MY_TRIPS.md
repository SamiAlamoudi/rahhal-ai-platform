# Sprint 13 — My Trips & Booking Records

Production-ready My Trips experience built on booking sessions from Sprints 11–12.

## Goals

- Persist completed booking sessions as **Booking Records** (projection, not a second store)
- Temporary Rahhal booking references (`RHL-XXXXXXXX`) until supplier confirmation
- My Trips tabs: Upcoming · Completed · Cancelled (+ All)
- Empty / loading / error states
- Booking Details: flight, passengers, fare, reference, status, timeline, concierge summary
- Concierge intents for trips / latest booking / details / itinerary summary
- Feature flags: `ui.my_trips` (alias **myTrips**), `ui.booking_history` (alias **bookingHistory**)

## Architecture

```
BookingSession (SoT)
  → attachBookingRecordMetadata / toBookingRecord
  → My Trips UI + Booking Details
  → Concierge replies via buildBookingHistoryConciergeReply
       (listBookingRecords DI on TravelAgentService)
```

- **No duplicate source of truth** — records project from `BookingSession`.
- Concierge package stays provider-agnostic; booking loads happen in the agent service layer.
- Saved Trips (`/saved-trips`) remain the plan library — separate from My Trips bookings.

## Package map

```
src/lib/booking/
  bookingRecord.ts
  myTripsQueries.ts
  bookingHistoryConcierge.ts
  bookingRecordConciergeSummary.ts
  bookingHistoryContext.ts

src/components/myTrips/
  TripRecordCard.tsx
  MyTripsEmptyState.tsx
  MyTripsLoadingState.tsx
  MyTripsErrorState.tsx

src/pages/MyTrips.tsx
src/pages/BookingDetailsPage.tsx   → /my-trips/:sessionId
```

## Concierge intents

| Intent | Examples |
|--------|----------|
| `show_trips` | “show my trips”, «رحلاتي» |
| `show_latest_booking` | “my latest booking”, «أحدث حجز» |
| `show_booking_details` | “booking details”, «تفاصيل الحجز» |
| `summarize_itinerary` | “summarize my itinerary”, «لخّص رحلتي» |

Gated by `ui.booking_history`. Replies use Sprint 9 `buildConsultantReply`.

## Feature flags

| ID | Alias | Depends on |
|----|-------|------------|
| `ui.my_trips` | myTrips | `ui.passenger_booking_flow` |
| `ui.booking_history` | bookingHistory | `ui.my_trips` |

## Tests

`src/lib/__tests__/myTrips.sprint13.test.ts`

## Frozen

Sprints 9–12 remain intact (additive wiring only).
