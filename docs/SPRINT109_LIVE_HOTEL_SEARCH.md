# Sprint 109 — Live Hotel Search (Amadeus Hotels)

**Type:** Additive agent bridge (`src/lib/agent/liveHotelSearch`) + Amadeus hotel TravelProvider  
**Position:** Provider Gateway → **Amadeus Hotel Search** → HotelOffer[] → Decision Engine → Response Composer

## Architecture

```
Conversation
        ↓
SearchPlanner
        ↓
Provider Gateway
        ↓
Amadeus Hotel Search   ← Sprint 109
        ↓
Hotel Offers
        ↓
Decision Engine
        ↓
Response Composer
```

## Feature flag

`ai.live_hotel_search` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | Runner returns `{ enabled: false }` — no provider calls |
| ON | Validate → Gateway → Amadeus hotel availability → HotelOffer[] + rankings |

## Notes

- Availability only — no booking.
- Additive Amadeus hotel provider (`createAmadeusHotelSearchProvider`) — does **not** change flight search provider.
- Reuses Gateway auth/retry/timeout/health/error/metrics plumbing.

## Verify

```bash
npm run live-hotel-search:verify
```
