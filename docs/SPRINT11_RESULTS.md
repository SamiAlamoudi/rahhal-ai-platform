# Sprint 11 — Flight Results Experience

Premium traveller-facing flight results on top of Sprint 9 Concierge and Sprint 10 live Amadeus search.

## Goals

- Reusable flight result cards (logo, airline, times, duration, stops, cabin, price, Select)
- Sort: Best · Cheapest · Fastest · Earliest departure · Latest departure
- Reusable filters: max price, stops, airlines, cabin, departure/arrival windows
- Flight details page (segments, layovers, aircraft, terminals, fare, baggage, policies)
- Concierge recommendation summary via existing consultant voice
- Select Flight → booking session ready for Sprint 12

## Architecture

```
Live search (Sprint 10)
  → NormalizedTravelOption[]
  → lib/flightResults (sort / filter / view model / summary / selection)
  → components/flightResults (UI)
  → /flights/:offerId (details)
  → createSessionFromFlightSelection → BookingSession
  → /booking/review
```

- **Provider-agnostic:** `src/lib/flightResults` never imports Amadeus/Duffel/etc.
- **Concierge reuse:** `buildFlightRecommendationSummary` → `buildConsultantReply`
- **Feature flag:** `ui.flight_results_experience` (depends on `ai.concierge`)

## Package map

```
src/lib/flightResults/
  types.ts
  sortFlights.ts
  filterFlights.ts
  viewModel.ts
  airlineLogo.ts
  recommendationSummary.ts
  createSessionFromSelection.ts
  index.ts

src/components/flightResults/
  FlightResultsList.tsx
  FlightResultCard.tsx
  FlightFiltersBar.tsx
  FlightSortBar.tsx
  FlightRecommendationBanner.tsx

src/pages/FlightDetailsPage.tsx
```

## Selection metadata (Sprint 12 ready)

Booking item `metadata` includes:

- `selectedItinerary`
- `pricing`
- `travellersPlaceholder`
- `bookingPayload`

## Tests

`src/lib/__tests__/flightResults.sprint11.test.ts`

## Frozen

Sprint 9 Concierge and Sprint 10 Amadeus paths remain intact (additive only).
