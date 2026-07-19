# Sprint 35 — Post Booking & Trip Management

Complete post-booking experience for Rahhal AI. After a successful Sprint 34 payment, automatically create **My Trip**, generate itinerary/documents, schedule notifications, monitor flights, and answer conversation trip queries.

## Non-goals (strict)

- Do not rewrite TripManager / TripRepository (Phase V) — **extend and reuse**
- Do not duplicate Sprint 34 payments, Sprint 33 execution, planner, or conversation planning logic
- Do not change Sprint 1–34 behavior when `brain.trip_management` is OFF
- Do not call live airline / email / SMS / WhatsApp APIs

## Architecture

```
PaymentOrchestrator (COMPLETED)
  → PostBookingService.createFromPayment
       ├─ TripManager.createTrip          (existing)
       ├─ TripRepository                  (existing)
       ├─ ItineraryGenerator
       ├─ TripDocuments (voucher / e-ticket / boarding / PDF / invoice bundle)
       ├─ NotificationScheduler (push / email / WhatsApp / SMS)
       ├─ FlightStatusMonitor (provider port)
       ├─ CancellationManager
       ├─ RefundStatusTracker
       ├─ TripTimeline (Upcoming / Active / Completed / Cancelled)
       └─ TripEvents / TripMetrics
```

| Module | Responsibility |
|--------|----------------|
| `PostBookingService` | Sprint 35 entry — create My Trip after payment |
| `TripManager` / `TripRepository` | Existing Phase V store (reused) |
| `TripTimeline` | Lifecycle buckets + display ordering |
| `TripDocuments` | Document bundle generation |
| `ItineraryGenerator` | Day-by-day post-booking itinerary |
| `HotelVoucherService` / `TicketService` / `BoardingPassService` | Document abstractions |
| `NotificationScheduler` | Multi-channel notification abstraction |
| `FlightStatusMonitor` | Flight status / gate / delay port |
| `CancellationManager` | Cancel post-booking + managed trip |
| `RefundStatusTracker` | Track refund lifecycle (payments execute refunds) |
| `TripEvents` / `TripMetrics` | Observability |
| `conversation/tripQueries` | My Trip / itinerary / ticket / delays / hotel answers |

## Trip Timeline

Buckets: **Upcoming · Active · Completed · Cancelled**

## Notifications

Channels: Push · Email · WhatsApp · SMS

Triggers: booking confirmed, payment received, check-in reminder, gate changes, flight delays, boarding reminder, hotel check-in reminder, trip completed.

## Conversation

When flag is ON, Conversation UI answers without re-planning:

- “My trip”
- “Show my itinerary”
- “Download my ticket”
- “Any delays?”
- “What hotel am I staying in?”

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `trip_management` | `brain.trip_management` | `brain.payments_platform` |

## Modules

`src/lib/trips/` (extends existing package)

## Tests

`src/lib/__tests__/tripManagement.sprint35.test.ts`
