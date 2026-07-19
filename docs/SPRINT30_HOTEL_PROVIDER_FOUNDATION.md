# Sprint 30 — Hotel Provider Foundation

Production-ready hotel provider foundation for Rahhal, mirroring the Amadeus flight provider architecture. Sandbox / mock mode only — **no production credentials**.

## Non-goals (strict)

- Do not enable live Hotelbeds / Expedia Rapid / Booking.com Connectivity HTTP
- Do not remove existing Booking.com RapidAPI or mock hotel adapters
- Do not change Search Aggregation ranking business logic
- Do not break Sprint 1–28 behavior when `providers.hotel_foundation` is OFF

## Architecture

```
HotelSearchRequest
  → HotelProviderRegistry (priority failover)
       ├─ Booking.com Connectivity (sandbox)
       ├─ Hotelbeds (sandbox)
       ├─ Expedia Rapid (sandbox)
       └─ Mock Hotels (safety net)
  → HotelSearchCache (15 min TTL)
  → HotelSearchNormalizer → NormalizedHotelResult
  → Bridges:
       ├─ contracts HotelOffer
       ├─ Phase W aggregation NormalizedOffer
       ├─ brain HotelSearchPayload → SearchAggregationEngine
       └─ AITripOrchestrator / Conversation Memory hints
```

| Component | Responsibility |
|-----------|----------------|
| `HotelProvider` | Generic interface: search, room availability, pricing, cancellation |
| `HotelProviderRegistry` | Priority chain, failover, timeout, retry, rate limit |
| `HotelSearchNormalizer` | Vendor-shaped rows → unified `NormalizedHotelResult` |
| `HotelSearchCache` | 15-minute in-memory search cache |
| `HotelHealthMonitor` | healthy / degraded / unhealthy tracking |
| `HotelProviderMetrics` | requests, retries, cache hits, fallbacks, latency |

## Normalized model

`NormalizedHotelResult` includes:

- Hotel search + room availability
- Pricing (nightly / stay total)
- Cancellation policy
- Taxes & fees normalization
- Images, amenities, star rating, guest reviews

## Adapters (sandbox)

| Adapter id | Display name | Notes |
|------------|--------------|-------|
| `booking_connectivity` | Booking.com Connectivity | Distinct from Phase W RapidAPI `booking_com` |
| `hotelbeds` | Hotelbeds | Sandbox inventory only |
| `expedia_rapid` | Expedia Rapid | Sandbox inventory only |
| `mock_hotels` | Mock Hotels | Ultimate failover |

## Resilience

- **Failover** — ordered provider chain; empty/error/timeout → next
- **Retry** — exponential backoff (`DEFAULT_HOTEL_RETRY_POLICY`)
- **Timeout** — per-attempt (default 2500ms)
- **Rate limiting** — token bucket per provider
- **Caching** — search key TTL 15 minutes
- **Health + metrics** — shared monitors for ops / tests

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `hotel_provider_foundation` | `providers.hotel_foundation` | `brain.execution` |

When enabled (or `createExecutionProviders({ hotelFoundationEnabled: true })`):

- Brain hotels provider id becomes `hotel_foundation`
- Multi-provider hotel chain uses Expedia / Hotelbeds sandbox adapters
- Aggregation helpers expose foundation adapters for hotels domain

## Integration

| Layer | Integration |
|-------|-------------|
| AITripOrchestrator | `searchHotelsForOrchestrator` / `hotelSearchRequestFromMemory` |
| Conversation Memory | Preferred hotel brands boost via `applyHotelMemoryPreferenceBoost` |
| Search Aggregation | `createHotelFoundationAggregationAdapters` + `toAggregationHotelOffers` |
| Travel Execution | `createFoundationHotelExecutionProvider` |
| Multi-provider chain | `createExpediaHotelAdapter` / `createHotelbedsHotelAdapter` |

## Modules

`src/lib/hotels/`

## Tests

`src/lib/__tests__/hotelProviderFoundation.sprint30.test.ts`

Coverage: unit normalization, sandbox adapters, failover, timeout, cache, rate limit, health/metrics, aggregation + execution bridges, memory/orchestrator helpers, flag-off compatibility.
