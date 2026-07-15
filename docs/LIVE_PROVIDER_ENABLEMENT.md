# Live Provider Enablement Preparation (Phase AJ)

Preparation and sandbox validation only. **Do not enable any live provider in production without a separate approval.**

Payments remain **`VITE_PAYMENT_PROVIDER=mock`**. This phase does not integrate real payments.

## Goals

- Canonical provider configuration registry
- Server-side secret *presence* validation (no secret values in logs/diagnostics)
- Config-only readiness checks + optional explicit sandbox probes
- Factory selection: mock by default; live only when flag ON + config valid
- Admin-only readiness diagnostics
- `npm run providers:check` (no network by default)

## Capability flags (all OFF by default)

| Capability | Env flag | FeatureRegistry id | Selection env |
|---|---|---|---|
| Master | `VITE_LIVE_PROVIDERS_ENABLED=false` | `providers.live_master` | — |
| Flights | `VITE_PROVIDERS_FLIGHTS_LIVE=false` | `providers.flights.live` | `VITE_FLIGHTS_PROVIDER=mock` |
| Hotels | `VITE_PROVIDERS_HOTELS_LIVE=false` | `providers.hotels.live` | `VITE_HOTELS_PROVIDER=mock` |
| Maps | `VITE_PROVIDERS_MAPS_LIVE=false` | `providers.maps.live` | `VITE_MAPS_PROVIDER=mock` |
| Weather | `VITE_PROVIDERS_WEATHER_LIVE=false` | `providers.weather.live` | `VITE_WEATHER_PROVIDER=mock` |
| Transport | `VITE_PROVIDERS_TRANSPORT_LIVE=false` | `providers.transport.live` | `VITE_TRANSPORT_PROVIDER=mock` |
| Activities | `VITE_PROVIDERS_ACTIVITIES_LIVE=false` | `providers.activities.live` | `VITE_ACTIVITIES_PROVIDER=mock` |

Phase AI aliases (`VITE_LIVE_FLIGHTS_ENABLED`, …) remain supported and also default OFF.

Kill switch: set `VITE_LIVE_PROVIDERS_ENABLED=false` (forces every capability live flag off for selection).

## Server secrets (never `VITE_*`)

| Provider | Required secret names | Optional |
|---|---|---|
| Amadeus | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | `AMADEUS_BASE_URL`, `AMADEUS_ENV` |
| Booking.com | `BOOKING_RAPIDAPI_KEY` (or `RAPIDAPI_KEY`) | `BOOKING_RAPIDAPI_HOST` |
| Google Maps | `GOOGLE_MAPS_API_KEY` | proxy URL via SPA (`VITE_GOOGLE_MAPS_PROXY_URL`) |
| OpenWeather | `OPENWEATHER_API_KEY` | proxy URL via SPA |

**Never** put provider credentials in `VITE_*` variables. Forbidden client exposures fail readiness.

## Sandbox vs production

- Amadeus sandbox host: `https://test.api.amadeus.com`
- Amadeus production host: `https://api.amadeus.com`
- Production mode rejects sandbox Amadeus URLs when `AMADEUS_ENV=production` / production base URL is in force
- Optional sandbox probes refuse production endpoints unless `CONFIRM_PRODUCTION_PROBE=true`

## How to enable exactly one provider (sandbox only)

Example — Amadeus flights only (still requires separate product approval before any real traffic):

```bash
# Server / Edge secrets (placeholders)
# AMADEUS_CLIENT_ID=your_sandbox_client_id
# AMADEUS_CLIENT_SECRET=your_sandbox_client_secret
# AMADEUS_BASE_URL=https://test.api.amadeus.com
# AMADEUS_ENV=sandbox

VITE_LIVE_PROVIDERS_ENABLED=true
VITE_PROVIDERS_FLIGHTS_LIVE=true
VITE_FLIGHTS_PROVIDER=amadeus
VITE_PROVIDER_MOCK_FALLBACK=true
VITE_PAYMENT_PROVIDER=mock
# Keep other VITE_PROVIDERS_*_LIVE=false
```

Missing credentials while the flag is ON → live not selected; mock fallback recorded (`fallbackUsed=true`).

## Readiness checks

```bash
npm run providers:check
```

Default behavior:

- configuration / readiness validation only
- **no outbound network calls**
- never prints credentials
- reports paymentProvider=mock

## Optional sandbox probe

```bash
PROVIDER_SANDBOX_PROBE=true npm run providers:check
# or
npm run providers:check -- --sandbox-probe
```

Production probes also need:

```bash
CONFIRM_PRODUCTION_PROBE=true PROVIDER_SANDBOX_PROBE=true npm run providers:check
```

Safety:

- refuse production endpoints without confirmation
- never print credentials
- strict timeouts / small request limits when a probeFn is wired
- read-only search operations only — never create reservations or bookings

## Fallback behavior

Documented matrix: `PROVIDER_FAILURE_POLICY` in `src/lib/agent/aggregation/providerEnablement/failurePolicy.ts`.

Rules of thumb:

- Missing credentials / invalid config / circuit open → mock fallback when `VITE_PROVIDER_MOCK_FALLBACK=true`
- `VITE_PROVIDER_STRICT_LIVE=true` → `strict_live_rejected` (no mock substitution)
- Fallback is never silent — selection logs + metrics record `fallbackUsed` / outcome

## Diagnostics

- Library: `getProviderDiagnostics({ user })` — admin-only (`role === 'admin'`)
- UI: `/diagnostics` → Provider readiness section (admin-only)
- Output masks secrets as `[set]` / `[missing]`
- No raw env dumps; no external calls unless explicit probe is requested and allowed

## Monitoring expectations

Metrics (via OpsMetricsRegistry):

- provider selection
- mock fallback
- readiness / configuration failures
- sandbox probes
- provider latency / errors / retries / rate limits / circuit-open

Structured logs include correlation ID, provider ID, capability, environment, selection/fallback outcome, masked error codes — never PII or secrets.

## Rollback

1. Set `VITE_LIVE_PROVIDERS_ENABLED=false`
2. Confirm `VITE_PAYMENT_PROVIDER=mock`
3. Redeploy or restart
4. Run `npm run providers:check` — all live selections should be `mock_default`

## Related

- `docs/CONFIGURATION.md`
- `docs/DEPLOYMENT.md`
- `docs/OBSERVABILITY.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `.env.example`
