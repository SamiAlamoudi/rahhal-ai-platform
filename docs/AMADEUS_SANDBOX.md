# Amadeus Sandbox (Production MVP)

Opt-in Amadeus **test** API for flight search in the Rahhal booking funnel. Defaults stay mock-safe.

## Architecture

```
SearchWorkspace / TravelConversation
  → orchestrateLiveSearch
  → getFlightService()          # integrations supplier abstraction
  → ProviderRegistry.getFlight()
  → AmadeusFlightAdapter        # when VITE_FLIGHT_PROVIDER=amadeus
       ├─ Edge amadeus-token    # OAuth (secrets server-side only)
       └─ test.api.amadeus.com  # sandbox host
  → ranked options + bookingUrl metadata
  → /booking/review → redirect or Rahhal checkout
```

The agent aggregation layer (`VITE_LIVE_PROVIDERS_ENABLED`) is separate. Enabling Phase W Amadeus does **not** switch the booking funnel; use `VITE_FLIGHT_PROVIDER` / `VITE_AMADEUS_ENABLED` for funnel search.

## Safe defaults

| Setting | Default |
|---------|---------|
| `VITE_FLIGHT_PROVIDER` | `mock` |
| `VITE_AMADEUS_ENABLED` | `false` |
| `VITE_AMADEUS_BASE_URL` | `https://test.api.amadeus.com` (when Amadeus selected) |
| Mock fallback on Amadeus error | **on** (FlightService) |

Never put `AMADEUS_CLIENT_SECRET` (or any Amadeus secret) in `VITE_*`.

## Staging pilot checklist

1. Deploy Edge Function `supabase/functions/amadeus-token` with secrets:
   - `AMADEUS_CLIENT_ID`
   - `AMADEUS_CLIENT_SECRET`
   - `AMADEUS_BASE_URL=https://test.api.amadeus.com`
2. SPA env:
   ```bash
   VITE_SUPABASE_URL=https://YOUR.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   VITE_FLIGHT_PROVIDER=amadeus
   VITE_AMADEUS_ENABLED=true
   VITE_AMADEUS_BASE_URL=https://test.api.amadeus.com
   # Keep agent live master off unless also approved:
   VITE_LIVE_PROVIDERS_ENABLED=false
   VITE_PAYMENT_PROVIDER=mock
   ```
3. Smoke: search → flight `sources.flight === 'real'` → select → BookingReview shows Amadeus handoff URL (`bookingUrl` with `offerId` + `env=sandbox`).
4. Kill switch: `VITE_FLIGHT_PROVIDER=mock`.

## Booking URL note

Amadeus Self-Service **Flight Offers Search** does not return a merchant checkout URL. Rahhal emits a safe HTTPS deep-link carrying the sandbox `offerId` for redirect booking mode. Flight Create Orders / live ticketing remain out of scope for this MVP step.

## Related code

- Adapter: `src/integrations/providers/amadeus/amadeusFlightAdapter.ts`
- Sandbox helpers: `src/integrations/providers/amadeus/amadeusSandbox.ts`
- Registry: `src/integrations/registry/providerRegistry.ts`
- Funnel map: `src/utils/liveSearchOrchestrator.ts` (`mapFlightOffer`)
