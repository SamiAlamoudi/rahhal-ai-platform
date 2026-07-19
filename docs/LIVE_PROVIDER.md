# Live Provider Integration — Sprint 10 (Flights)

Real travel search through the existing multi-provider architecture.  
**Flights first** (this document). Hotels / activities / cars follow the same pattern later.

## Phase 1 audit (readiness)

| Provider | Score | Status |
|----------|------:|--------|
| **Amadeus Self-Service** | **8/10** | Live path exists; Sprint 10 completes RT/children/pricing/booking-ready |
| Amadeus Enterprise | N/A | Not in repo (Self-Service only) |
| **Duffel** | 1.5/10 | Mock aggregation slot only — **no HTTP client** |
| Travelport | 0 | Absent (name-guards only) |
| Sabre | 0 | Absent (name-guards only) |

**Chosen provider:** Amadeus Self-Service (closest to production). Duffel preferred by product order but unavailable as a live client.

### Missing before Sprint 10

| Gap | Notes |
|-----|-------|
| Credentials | Edge secrets `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` (ops) |
| Return / children / infants on search | Wired in Sprint 10 |
| Flight Offers Price | Wired in Sprint 10 |
| Booking-ready payload | Wired in Sprint 10 (no payment) |
| Flight Create Orders / ticketing | Still out of scope |

## Architecture

Concierge and planning stay **provider-agnostic**. Providers live under integrations + aggregation only.

```
UI / TravelConversation / SearchWorkspace
  → orchestrateLiveSearch
  → FlightService
  → ProviderRegistry.getFlight()
  → AmadeusFlightAdapter          # when VITE_FLIGHT_PROVIDER=amadeus
       ├─ Edge amadeus-token      # OAuth (secrets server-side)
       ├─ GET  /v1/reference-data/locations
       ├─ GET  /v1/shopping/flight-offers
       └─ POST /v1/shopping/flight-offers/pricing
  → on failure → MockFlightAdapter (source: fallback)

Agent tools (separate stack)
  → AggregationEngine (priority_fallback)
  → amadeus (live) → amadeus_mock / duffel mock …
```

### Provider flow (flights)

1. Resolve origin/destination → IATA (`airportResolution` + locations API)
2. Search offers (one-way or round-trip; adults/children/infants; cabin; currency)
3. Normalize → `FlightOffer` (+ baggage when present)
4. Optional: `getOfferDetails(offerId)` → Flight Offers Price
5. Build `AmadeusBookingReadyPayload` (priced offer + traveler slots, `payment: null`)
6. Fallback to mock if live Amadeus errors

## Required environment variables

### Edge (Supabase secrets — never `VITE_*`)

| Variable | Purpose |
|----------|---------|
| `AMADEUS_CLIENT_ID` | Amadeus API key |
| `AMADEUS_CLIENT_SECRET` | Amadeus API secret |
| `AMADEUS_BASE_URL` | Default `https://test.api.amadeus.com` |

### SPA

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | — | Invoke Edge `amadeus-token` |
| `VITE_SUPABASE_ANON_KEY` | — | Invoke Edge function |
| `VITE_FLIGHT_PROVIDER` | `mock` | Set `amadeus` for live funnel |
| `VITE_AMADEUS_ENABLED` | `false` | Extra enable gate |
| `VITE_AMADEUS_BASE_URL` | sandbox host | Amadeus API host |
| `VITE_LIVE_PROVIDERS_ENABLED` | `false` | Agent aggregation master (orthogonal) |
| `VITE_PROVIDER_MOCK_FALLBACK` | `true` | Keep mock adapters for fallback |
| `VITE_PAYMENT_PROVIDER` | `mock` | Payments remain frozen |

## Setup instructions

1. Deploy Edge Function `supabase/functions/amadeus-token` with Amadeus secrets.
2. Set SPA env (preview/staging):
   ```bash
   VITE_FLIGHT_PROVIDER=amadeus
   VITE_AMADEUS_ENABLED=true
   VITE_AMADEUS_BASE_URL=https://test.api.amadeus.com
   VITE_SUPABASE_URL=https://YOUR.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   VITE_PAYMENT_PROVIDER=mock
   VITE_LIVE_PROVIDERS_ENABLED=false
   ```
3. Smoke search: expect `sources.flight === 'real'`.
4. Kill switch: `VITE_FLIGHT_PROVIDER=mock`.

### Booking-ready (no payment)

```ts
const adapter = registry.getFlight() // AmadeusFlightAdapter when live
const search = await adapter.searchFlights(req)
const details = await adapter.getOfferDetails(search.data[0].id)
// details.data.bookingReady — pricedFlightOffer + travelerSlots, payment: null
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Always `source: fallback` | Token proxy missing / 503 | Deploy `amadeus-token` + secrets |
| `AMADEUS_INVALID_CREDENTIALS` | Wrong client id/secret | Rotate Edge secrets |
| `AMADEUS_QUOTA_EXCEEDED` | Sandbox quota | Wait / upgrade Amadeus plan |
| `AMADEUS_TIMEOUT` | Slow network / low timeout | Increase adapter timeout; retry |
| `AMADEUS_UNAVAILABLE` | Bad host / 404 | Check `VITE_AMADEUS_BASE_URL` |
| Offer price fails “not in cache” | Price without prior search | Call `searchFlights` first |
| Agent still mock | Funnel flags ≠ Phase W | Set `VITE_LIVE_PROVIDERS_ENABLED=true` separately |

## What Sprint 10 does **not** change

- Concierge / conversation intelligence
- Planning / requirement extraction
- Provider registry architecture
- Recommendation engine
- TravelSession model
- UI
- Payment / Create Orders

## Related code

- Adapter: `src/integrations/providers/amadeus/amadeusFlightAdapter.ts`
- API client: `src/integrations/providers/amadeus/amadeusFlightApiClient.ts`
- Booking-ready: `src/integrations/providers/amadeus/bookingReadyPayload.ts`
- Chain: `src/integrations/providers/flightService.ts`
- Registry: `src/integrations/registry/providerRegistry.ts`
- Tests: `src/integrations/providers/amadeus/__tests__/amadeus.liveProvider.sprint10.test.ts`
- Prior sandbox note: `docs/AMADEUS_SANDBOX.md`
