# Live Flight Provider Report — Integration Sprint 2

**Branch:** `cursor/live-flight-search-7518`  
**Generated:** 2026-07-25  

---

## Provider interface

Business logic does **not** couple to Amadeus. Conversation tools call:

1. `runConversationAwareFlightSearch` (Integration Sprint 2)
2. → `runLiveFlightSearch` / Provider Gateway / `TravelProvider.searchFlights`
3. → Amadeus sandbox/live adapter **or** mock fallback

Canonical multi-provider contracts remain under `src/utils/contracts/providers/FlightProvider.ts` and Provider Runtime (`amadeus` | `duffel` | `mock`).

---

## Amadeus capabilities (wired)

| Capability | Status |
|---|---|
| OAuth client_credentials | `api/amadeus-token` + adapter OAuth managers |
| Token refresh / 401 retry | Existing |
| One-way search | Yes |
| Round-trip (`returnDate`) | Yes |
| Multi-city | Engine trip type + leg metadata; live call uses primary OD (GET Offers) |
| Cabin class | Forwarded (`travelClass`) |
| Adults / children | Forwarded |
| Currency | `currencyCode` |
| Language | Conversation locale ar/en (consultant text); Amadeus body remains structured |
| Timezone | Traveler timezone recorded (`Asia/Riyadh` default); dates normalized YYYY-MM-DD |

---

## Normalization model

All providers map into ranked conversation offers:

| Field | Source |
|---|---|
| Price / currency | Provider offer |
| Duration | minutes |
| Stops | count |
| Airline / flight number | carrier |
| Departure / arrival | ISO timestamps |
| Fare family | when present |
| Baggage | when present |
| Refundability | boolean |
| Score + WHY reasons | Integration ranking |

---

## Error handling

| Failure | Behavior |
|---|---|
| Flag OFF | Mock engine only |
| Expired token | OAuth refresh / retry (existing) |
| Rate limit / unavailable | Live result error → mock fallback |
| Network / timeout | Graceful message + mock offers |
| Empty live results | Fallback mock when `fallbackToMock` |

---

## Caching

| Layer | TTL | Key |
|---|---|---|
| Conversation bridge | 15 min | origin/dest/dates/pax/cabin/currency/prefs/live |
| Flight Search Engine | 15 min (`flight_routes`) | trip + OD + pax + cabin + currency |
