# Sprint 17 — Smart Itinerary AI Engine

Transforms Rahhal into an AI Travel Companion after booking confirmation: generate a structured `TripItinerary` from existing booking data (rule-based today, LLM-ready tomorrow).

## Architecture

```
BookingSession (source of truth)
        │
        ▼
BookingRecord / Confirmation / Order (projections)
        │
        ▼
TripItinerary  ──references──► bookingSessionId (+ optional orderId)
        │
        ├── Timeline
        ├── DayPlan[]
        └── TravelInsight[]
```

No duplicated booking state. Itinerary is derived and cached in-memory by session id.

## Engine (`src/lib/smartItinerary`)

| Module | Responsibility |
|--------|----------------|
| `engine.ts` | `generateTripItinerary` / `getOrGenerateItinerary` |
| `timeline.ts` | Departure → airport → flight → arrival → hotel/transport placeholders → daily → return |
| `dailyPlanner.ts` | Morning / Afternoon / Evening / Free time + notes (`generatedBy: placeholder`) |
| `travelInsights.ts` | Airport, travel time, timezone, packing, weather, currency, visa (arch-ready) |
| `itineraryConcierge.ts` | Concierge answers for itinerary questions |

## UI

- Route: `/itinerary/:sessionId` (`SmartItineraryPage`)
- Components: `ItineraryTimeline`, `TimelineItemView`, `DayCard`, `DailyAgenda`, `TravelInsightCard`, `TripSummaryCard`
- Linked from Confirmation (when confirmed) and Booking Details

## Concierge intents

| Intent | Examples |
|--------|----------|
| `show_my_itinerary` | Show my itinerary / أظهر جدولي |
| `whats_todays_plan` | What's today's plan? / خطة اليوم |
| `when_leave_for_airport` | When should I leave for the airport? |
| `summarize_my_trip` | Summarize my trip / لخّص رحلتي |

Gated by `ui.smart_itinerary` (above order/confirmation/history in `travelAgentService`).

## Feature flags

| Product alias | Registry ID | Depends on |
|---------------|-------------|------------|
| `smart_itinerary` | `ui.smart_itinerary` | `ui.booking_confirmation` |
| `travel_insights` | `ui.travel_insights` | `ui.smart_itinerary` |
| `daily_planner` | `ui.daily_planner` | `ui.smart_itinerary` |

## Library entry

```ts
import {
  generateTripItinerary,
  getOrGenerateItinerary,
  buildSmartItineraryConciergeReply,
  itineraryPath,
} from '@/lib/smartItinerary'
```

## Tests

`src/lib/__tests__/smartItinerary.sprint17.test.ts`

## Non-goals

- Live weather / maps / visa / FX integrations (architecture-ready only)
- Replacing agent `buildItinerary` pre-booking TripPlan
- Replacing checkout payment `itineraryGenerator` receipt segments
- Breaking Sprints 9–16
