# Sprint 26 — Real Provider Integration (Production MVP)

Replace mock-only execution search with a provider-adapter architecture that supports **mock**, **real**, and **mixed** providers — without creating a new engine.

## Non-goals (strict)

- Do not create a new Search / Aggregation / Booking / Planning engine
- Do not remove mock providers
- Do not change Search Aggregation business logic or UI
- Do not enable live HTTP by default (`VITE_LIVE_PROVIDERS_ENABLED` stays false)

## Architecture

```
TripPlan
  → TravelExecutionEngine
  → ExecutionProviderBundle
       ├─ FlightProvider   (mock_flights | amadeus_flights)
       ├─ HotelProvider    (mock_hotels | booking_hotels)
       ├─ TransportProvider
       ├─ ActivitiesProvider  (alias: ActivityProvider)
       └─ PackageProvider
  → ExecutionResult payloads (kind + offers, mock: boolean)
  → SearchAggregationEngine (unchanged normalize/rank/recommend)
  → BookingFlowController
```

Every provider implements the same brain execution interfaces. Real adapters wrap existing Phase W Amadeus / Booking.com aggregation adapters and normalize into the existing `*SearchPayload` models.

## Configuration

| Source | Role |
|--------|------|
| `brain.real_providers` | FeatureRegistry gate (default **OFF**) |
| `VITE_EXECUTION_PROVIDER_MODE` | `mock` \| `real` \| `mixed` |
| `VITE_BRAIN_REAL_PROVIDERS` | env alias to prefer real adapters |
| `VITE_LIVE_PROVIDERS_ENABLED` | Phase W live-HTTP kill switch |
| `VITE_PROVIDER_MOCK_FALLBACK` | fallback to mock on failure (default true) |
| `VITE_PROVIDER_TIMEOUT_MS` | default timeout |
| `VITE_PROVIDER_MAX_RETRIES` | retry budget |
| `VITE_PROVIDER_CACHE_TTL_MS` | cache TTL |

Per-domain: priority, primary id, fallback id, timeout, retries, preferReal.

## Resilience

- **Fallback** — primary failure → mock (when enabled)
- **Retry** — existing ExecutionOrchestrator task retries
- **Timeout** — orchestrator + config timeoutMs
- **Cache** — search / session / provider TTL caches
- **Monitoring** — latency, availability, error rate, response quality, health

## Modes

| Mode | Behavior |
|------|----------|
| `mock` | All mock providers (default) |
| `mixed` | Real flights + hotels (with mock fallback); mock transport/activities/packages |
| `real` | Prefer real-shaped adapters for all domains (still mock fallback) |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_real_providers` | `brain.real_providers` | `brain.execution` |

## Modules

`src/lib/brain/execution/providers/`

## Provider guide

See `docs/PROVIDER_ADAPTER_GUIDE.md`.

## Tests

`src/lib/__tests__/realProviders.sprint26.test.ts`
