# Sprint 56 — Live Travel Provider Layer

Provider-agnostic live integrations for Rahhal. Structured offers only —
Conversation Brain authors traveler-facing text; Booking Intelligence ranks;
Autonomous Agent orchestrates.

## Module

`src/lib/agent/liveProviders/`

| Piece | Role |
| --- | --- |
| `types.ts` | Common SDK contract (`searchFlights/Hotels/Activities/Cars/Transfers/Insurance`) |
| `adapters/amadeus.ts` | Sprint 59 flight search, airports, offers, pricing + OAuth |
| `adapters/duffel.ts` | Offer search/details/pricing; order/cancel stubs |
| `adapters/booking.ts` | Sprint 60 hotel search + full normalize (address, room, taxes, amenities, …) |
| `oauth.ts` | Amadeus client-credentials, cache, refresh, 401 retry |
| `health.ts` | Latency / uptime / quota / failures / quality → auto-disable |
| `rateLimiter.ts` | Per-provider token bucket + queue |
| `cache.ts` | Airports, cities, hotels, routes, currencies (TTL) |
| `selection.ts` | Availability, speed, quota, coverage, quality routing + failover |
| `metrics.ts` | API latency, failures, cache hit ratio, search/ranking, readiness |
| `secrets.ts` | `.env` / Vercel / GHA presence snapshot — never expose keys |
| `bridge.ts` | `LiveProviderSdk` → Sprint 55 `BookingProvider` |
| `registry.ts` | Runtime composition |

## Feature flags

| Flag | Default |
| --- | --- |
| `ai.live_providers` | OFF |
| `provider.amadeus` | OFF |
| `provider.duffel` | OFF |
| `provider.booking` | OFF |

Also gated by env: `VITE_LIVE_PROVIDERS_ENABLED` / `PROVIDER_*_LIVE` (see `.env.example`).

## Secrets

Server-only (never `VITE_*` OAuth secrets):

- `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` (preferred; Sprint 59)
- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` (aliases)
- `DUFFEL_API_TOKEN`
- `BOOKING_API_KEY` / `RAPIDAPI_KEY` / `BOOKING_RAPIDAPI_KEY` (Booking.com)

Works with local `.env`, Vercel env, and GitHub Actions secrets.

Mock / simulated providers remain the default when live flags are OFF
(`VITE_FLIGHT_PROVIDER=mock`, `ai.live_providers` / `provider.amadeus` /
`provider.booking` disabled).

## Booking Intelligence

`getDefaultBookingProviderRegistry()` keeps simulated providers and optionally
appends live bridges when the live layer is enabled. No Conversation Brain changes.

## Tests

`src/lib/__tests__/liveProviders.sprint56.test.ts` — injectable `fetch`, no network.
`src/lib/__tests__/amadeus.sprint59.test.ts` — Amadeus OAuth / search / mapping.
`src/lib/__tests__/booking.sprint60.test.ts` — Booking.com hotel normalize / errors.
