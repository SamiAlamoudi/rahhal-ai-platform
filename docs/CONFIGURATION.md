# Configuration (Phase AI)

Centralized configuration lives in `src/lib/ops/production/appConfig.ts` and is loaded at startup via `loadAppConfig()` / `getAppConfig()`.

## Live capability feature flags

All default **OFF**.

| Capability | Env var | FeatureRegistry id |
|---|---|---|
| Master live travel | `VITE_LIVE_PROVIDERS_ENABLED` | `providers.live_master` |
| Live Flights | `VITE_LIVE_FLIGHTS_ENABLED` / `VITE_PROVIDERS_FLIGHTS_LIVE` | `live.flights` / `providers.flights.live` |
| Live Hotels | `VITE_LIVE_HOTELS_ENABLED` / `VITE_PROVIDERS_HOTELS_LIVE` | `live.hotels` / `providers.hotels.live` |
| Live Maps | `VITE_PROVIDERS_MAPS_LIVE` | `providers.maps.live` |
| Live Weather | `VITE_PROVIDERS_WEATHER_LIVE` | `providers.weather.live` |
| Live Activities | `VITE_LIVE_ACTIVITIES_ENABLED` / `VITE_PROVIDERS_ACTIVITIES_LIVE` | `live.activities` / `providers.activities.live` |
| Live Transport | `VITE_LIVE_TRANSPORT_ENABLED` / `VITE_PROVIDERS_TRANSPORT_LIVE` | `live.transport` / `providers.transport.live` |
| Live Payments | `VITE_LIVE_PAYMENTS_ENABLED` | `live.payments` |

Rules:

- Travel capability flags require the master switch
- Live payments must remain disabled while `VITE_PAYMENT_PROVIDER=mock`
- Enabling a flag does **not** by itself call live providers (Phase AJ readiness + secrets still gate selection)
- Provider selection examples (defaults stay `mock`): `VITE_FLIGHTS_PROVIDER=amadeus`, `VITE_HOTELS_PROVIDER=booking`, `VITE_MAPS_PROVIDER=google_maps`, `VITE_WEATHER_PROVIDER=openweather`

See `docs/LIVE_PROVIDER_ENABLEMENT.md` for sandbox enablement (Phase AJ prep + Phase AK single-provider exclusivity).
At most one `VITE_PROVIDERS_*_LIVE` capability may be active; extra flags are suppressed (prefer flights / `VITE_SINGLE_LIVE_CAPABILITY`).

## Timeouts

| Knob | Env | Default |
|---|---|---|
| Request | `VITE_REQUEST_TIMEOUT_MS` | 30000 |
| Planning | `VITE_PLANNING_TIMEOUT_MS` | 30000 |
| Booking | `VITE_BOOKING_TIMEOUT_MS` | 20000 |
| Provider | `VITE_PROVIDER_TIMEOUT_MS` | 8000 |
| Health | `VITE_HEALTH_TIMEOUT_MS` | 2000 |

## Retry policies

Configured in `DEFAULT_RETRY_POLICIES` (`src/lib/ops/production/retryPolicy.ts`):

| Domain | maxAttempts | baseDelayMs | maxDelayMs |
|---|---|---|---|
| provider | 2 | 40 | 250 |
| booking | 2 | 50 | 400 |
| planning | 1 | 0 | 0 |
| notification | 3 | 100 | 1000 |
| default | 2 | 40 | 250 |

## Rate limits

Domain limits (in-memory) in `securityPolicy` / `AppConfig.rateLimits`:

auth, search, booking, payment, ticketing, notification, ops, trip_planner_*.

## CORS / request size

- Allowlist: `VITE_CORS_ALLOWLIST` (comma-separated origins)
- Max body: `VITE_MAX_REQUEST_BYTES` (default 256KiB)

## OpenTelemetry

- `VITE_OTEL_ENABLED=true` records intent; hooks are no-op until a tracer provider is registered via `setTracerProvider()`
- No OpenTelemetry SDK is bundled by default

## Secrets

Server-only (never `VITE_*`):

- `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` / `AMADEUS_BASE_URL`
- `BOOKING_RAPIDAPI_KEY` / `BOOKING_RAPIDAPI_HOST` (or `RAPIDAPI_KEY`)
- `GOOGLE_MAPS_API_KEY`
- `OPENWEATHER_API_KEY`
- `MOYASAR_SECRET_KEY`

Startup validation fails if forbidden `VITE_*` secrets are present.

## Provider readiness CLI

```bash
npm run providers:check
```

Config/readiness only by default (no network). Optional: `PROVIDER_SANDBOX_PROBE=true`.

## Related

- `docs/LIVE_PROVIDER_ENABLEMENT.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
