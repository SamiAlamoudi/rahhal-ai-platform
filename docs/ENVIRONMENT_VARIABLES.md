# Environment Variables

Templates:

- `.env.example` — local development
- `.env.preview.example` — preview deployment (Production MVP; never production)
- `.env.staging.example` — staging
- `.env.production.example` — production

Preview runbook: [PREVIEW_DEPLOYMENT.md](./PREVIEW_DEPLOYMENT.md)

## SPA (`VITE_*`)

| Variable | Purpose | Safe default |
|----------|---------|--------------|
| `VITE_DEPLOY_TARGET` | `development` \| `preview` \| `staging` \| `production` | `development` |
| `VITE_SUPABASE_URL` | Supabase project | required for auth |
| `VITE_SUPABASE_ANON_KEY` | SPA invoke / auth | required for auth |
| `VITE_PAYMENT_PROVIDER` | Payment adapter | **`mock`** |
| `VITE_LIVE_PROVIDERS_ENABLED` | Master live-provider switch | **`false`** |
| `VITE_PROVIDER_MOCK_FALLBACK` | Keep mocks for fallback | `true` |
| `VITE_FLIGHT_PROVIDER` / `VITE_AMADEUS_ENABLED` | Booking-funnel flights (`amadeus` opt-in) | `mock` / `false` |
| `VITE_AMADEUS_BASE_URL` | Amadeus API host for funnel adapter | sandbox `https://test.api.amadeus.com` |
| `VITE_AMADEUS_TOKEN_URL` | Optional Edge token proxy override | `{SUPABASE}/functions/v1/amadeus-token` |
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
| `RAPIDAPI_KEY` / `BOOKING_RAPIDAPI_KEY` | Booking.com |
| `OPS_ALLOWED_ORIGINS` | ops-health CORS allowlist |
| `MOYASAR_*` | **Do not enable** until payment freeze lifts |

## Validation

`validateEnvironment()` / `assertValidEnvironment()` reject forbidden client secrets and enforce mock payments for preview/staging/production targets.

`verifyPreviewEnvironment()` / `npm run preview:verify` additionally require Supabase URL+anon and keep live providers OFF for preview builds.
