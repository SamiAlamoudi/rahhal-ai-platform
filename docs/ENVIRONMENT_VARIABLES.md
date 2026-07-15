# Environment Variables

Templates:

- `.env.example` — local development
- `.env.staging.example` — staging
- `.env.production.example` — production

## SPA (`VITE_*`)

| Variable | Purpose | Safe default |
|----------|---------|--------------|
| `VITE_DEPLOY_TARGET` | `development` \| `staging` \| `production` | `development` |
| `VITE_SUPABASE_URL` | Supabase project | required for auth |
| `VITE_SUPABASE_ANON_KEY` | SPA invoke / auth | required for auth |
| `VITE_PAYMENT_PROVIDER` | Payment adapter | **`mock`** |
| `VITE_LIVE_PROVIDERS_ENABLED` | Master live-provider switch | **`false`** |
| `VITE_LIVE_FLIGHTS_ENABLED` | Live flights capability (Phase AI) | **`false`** |
| `VITE_LIVE_HOTELS_ENABLED` | Live hotels capability (Phase AI) | **`false`** |
| `VITE_LIVE_ACTIVITIES_ENABLED` | Live activities capability (Phase AI) | **`false`** |
| `VITE_LIVE_TRANSPORT_ENABLED` | Live transport capability (Phase AI) | **`false`** |
| `VITE_LIVE_PAYMENTS_ENABLED` | Live payments capability (Phase AI) | **`false`** (must stay off) |
| `VITE_PROVIDERS_FLIGHTS_LIVE` … `VITE_PROVIDERS_ACTIVITIES_LIVE` | Phase AJ capability live flags | **`false`** |
| `VITE_FLIGHTS_PROVIDER` / `VITE_HOTELS_PROVIDER` / `VITE_MAPS_PROVIDER` / `VITE_WEATHER_PROVIDER` | Provider selection | **`mock`** |
| `VITE_PROVIDER_STRICT_LIVE` | Forbid mock fallback | **`false`** |
| `VITE_REQUEST_TIMEOUT_MS` | Default request timeout | `30000` |
| `VITE_PLANNING_TIMEOUT_MS` | Trip planning timeout | `30000` |
| `VITE_BOOKING_TIMEOUT_MS` | Booking timeout | `20000` |
| `VITE_PROVIDER_TIMEOUT_MS` | Provider call timeout | `8000` |
| `VITE_OTEL_ENABLED` | Enable OTel hooks registration | `false` |
| `VITE_CORS_ALLOWLIST` | Comma-separated CORS origins | empty = permissive dev |
| `VITE_PROVIDER_MOCK_FALLBACK` | Keep mocks for fallback | `true` |
| `VITE_FLIGHT_PROVIDER` / `VITE_AMADEUS_ENABLED` | Flights selection | `mock` / `false` |
| `VITE_HOTEL_ADAPTER` / `VITE_BOOKING_PROVIDER` | Hotels | `mock` for staging template |
| `VITE_MAPS_PROVIDER` | Maps | `mock` for staging template |
| `VITE_WEATHER_PROVIDER` | Weather | `mock` for staging template |
| `VITE_*_PROXY_URL` | Edge proxy URLs | derived from Supabase URL |

## Server / Edge (never `VITE_*`)

| Variable | Purpose |
|----------|---------|
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | Amadeus OAuth |
| `AMADEUS_ENV` / `AMADEUS_BASE_URL` | sandbox \| production |
| `GOOGLE_MAPS_API_KEY` | Maps proxy |
| `OPENWEATHER_API_KEY` | Weather proxy |
| `RAPIDAPI_KEY` / `BOOKING_RAPIDAPI_KEY` / `BOOKING_RAPIDAPI_HOST` | Booking.com |
| `PROVIDER_SANDBOX_PROBE` / `CONFIRM_PRODUCTION_PROBE` | Optional readiness probe opt-in (CLI) |
| `OPS_ALLOWED_ORIGINS` | ops-health CORS allowlist |
| `MOYASAR_*` | **Do not enable** until payment freeze lifts |

## Validation

`validateEnvironment()` / `assertValidEnvironment()` reject forbidden client secrets and enforce mock payments for staging/production targets.
