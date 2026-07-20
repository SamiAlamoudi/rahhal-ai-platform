# Sprint 53 — Real World Intelligence Layer

Connects Rahhal to live travel signals through provider abstractions. **RahhalBrain remains the only orchestrator.** No parallel AI framework.

## Architecture

```
User → RahhalBrain
         → Reasoning / Executive / OS
         → Sprint 53 Live Intelligence
              select domains → provider.search()
              cache / circuit / retry / events
         → Response (+ live evidence)
```

## Providers

Every provider implements:

- `search()` / `availability()` / `pricing()` / `booking()` / `cancel()` / `status()`

| Domain | Mock provider id |
|--------|------------------|
| Flight | `mock.flight` |
| Hotel | `mock.hotel` |
| Weather | `mock.weather` |
| Visa | `mock.visa` |
| Events | `mock.event` |
| Safety | `mock.safety` |
| Exchange | `mock.exchange` |
| Transport | `mock.transport` |
| Price watch | `mock.price_watch` |

Live HTTP adapters plug into the same `LiveProvider` contract without changing RahhalBrain. When credentials are unavailable, production-grade deterministic mocks are used (not placeholders).

## Event bus

`PriceChanged` · `WeatherChanged` · `FlightDelayed` · `VisaUpdated` · `HotelUnavailable` · `ExchangeRateChanged` · `TripAffected`

## Cache & resilience

- L1 TTL + soft TTL + offline fallback
- Retry + timeout + circuit breaker
- Graceful degradation — conversation never crashes

## Feature flag

- `ai.real_world_intelligence` (default **ON**)
- Depends on `ai.rahhal_brain`
- Meta: `AgentProviderMeta.liveIntelligence`

## Package

```
src/lib/brain/intelligence/
  providers/     # contract + mocks + registry
  cache.ts
  eventBus.ts
  resilience.ts
  observability.ts
  orchestrator.ts
```

## Tests

`src/lib/__tests__/realWorldIntelligence.sprint53.test.ts`

## Migration

No migration. Disable the flag to fall back to catalog/static reasoning only.
