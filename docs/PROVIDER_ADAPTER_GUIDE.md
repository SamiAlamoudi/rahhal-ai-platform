# Provider Adapter Guide (Sprint 26)

How to add or switch execution search providers for the Travel Brain pipeline.

## Interfaces

All providers live under `src/lib/brain/execution` and implement:

| Interface | Payload `kind` |
|-----------|----------------|
| `FlightProvider` | `flights` |
| `HotelProvider` | `hotels` |
| `TransportProvider` | `transport` |
| `ActivitiesProvider` (`ActivityProvider` alias) | `activities` |
| `PackageProvider` | `packages` |

Contract:

```ts
interface FlightProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<FlightSearchPayload>
}
```

`FlightSearchPayload.mock` is `boolean` — `true` for mocks, `false` for real adapters.

## Keep mocks

`createMockExecutionProviders()` remains the default bundle. Never delete mock factories.

## Switch providers

```ts
import { createExecutionProviders } from '../brain/execution'

const { providers, config } = createExecutionProviders({
  mode: 'mixed', // mock | real | mixed
  brainRealProvidersEnabled: true,
  mockFallback: true,
  deps: {
    // unit tests: inject results, no live HTTP
    amadeusSearch: async () => ({ /* ProviderFetchResult */ }),
    bookingSearch: async () => ({ /* ProviderFetchResult */ }),
  },
})
```

Wire into the engine:

```ts
TravelExecutionEngine({ conversationId, providers })
```

Production path: `getOrCreateTravelExecutionEngine` calls `createExecutionProviders` when `brain.real_providers` is on.

## Real adapters

| Domain | Adapter id | Wraps |
|--------|------------|-------|
| Flights | `amadeus_flights` | Phase W `createAmadeusProviderAdapter` |
| Hotels | `booking_hotels` | Phase W `createBookingComProviderAdapter` |
| Hotels (Sprint 30) | `hotel_foundation` | `HotelProviderRegistry` sandbox chain (flag `providers.hotel_foundation`) |
| Transport | `maps_transport` | Real-shaped (injectable) |
| Activities | `real_activities` | Real-shaped (injectable) |
| Packages | `real_packages` | Real-shaped (injectable) |

Live HTTP still requires Phase W configuration (`VITE_LIVE_PROVIDERS_ENABLED`, secrets). Without credentials, resilience falls back to mock.

## Normalization

Adapters must return the existing offer shapes expected by `normalizeExecutionResults` (Sprint 24). Do not invent new UI models.

## Monitoring & cache

```ts
import {
  getProviderMonitorSnapshot,
  getProviderCache,
  clearAllProviderCaches,
} from '../brain/execution'
```

Caches: `search` · `session` · `provider` with TTL.

## Checklist for a new vendor

1. Implement the matching `*Provider` interface
2. Map vendor response → existing `*SearchPayload`
3. Register in `createExecutionProviders` behind config
4. Keep mock as fallback
5. Add unit tests with injected deps (no network)
6. Document id + env knobs here
