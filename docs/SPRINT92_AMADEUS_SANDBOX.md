# Sprint 92 — First Live Travel Provider Integration (Amadeus Sandbox)

**Type:** Additive TravelProvider (`src/core/amadeusSandbox` + agent bridge)  
**Depends on:** Sprint 90 Provider Readiness (Registry · Retry · CircuitBreaker · Health · error taxonomy)

## Goal

Connect the **first real travel provider** — Amadeus Sandbox — through the existing provider abstraction, without redesigning engines or modifying Provider Readiness sources.

## Architecture

```
Conversation / Search Planner
        ↓
Provider Registry (Sprint 90)
        ↓
Amadeus Sandbox TravelProvider   ← Sprint 92
        ↓
Normalize Results
        ↓
Decision Engine → Packages → Refinement → Recommendation
```

- Implements `TravelProvider` (`mode: 'sandbox'`)
- Flights only (hotels/packages return unsupported)
- Registers via `registerAmadeusSandboxProvider(registry)` / `createAmadeusSandboxRegistry()`
- Reuses `createProviderRetryPolicy`, `createProviderCircuitBreaker`, `classifyProviderFailure`, `ProviderRegistry.searchFlightsWithFailover`

**Not modified:** Constitution, Conversation, Learning, Decision Engine, Packages, Refinement, Alpha Experience, Unified Trip, Booking Orchestrator, Provider Readiness source files.

## Compatibility (Sprint 91 / 93 / 94)

Amadeus Sandbox stays an isolated provider. Additive adapters only:

| Adapter | Target |
|---------|--------|
| `toDecisionEngineFlightOffer` | Decision Engine / packages |
| `toUnifiedTripFlightOffer` | Sprint 93 `composeUnifiedTrip` flightOffers |
| `toBookableFlightSegment` | Sprint 94 BookableTrip flight shape |

Prefer: Amadeus → Unified Trip → `toBookableTrip` → Booking Orchestrator.

## Authentication

`AmadeusSandboxOAuth`:

- Client-credentials grant against `{baseUrl}/v1/security/oauth2/token`
- Token cache with skew-based refresh
- Automatic refresh + single auth retry on HTTP 401
- Secrets never logged or emitted in events (redacted)

Credentials (server-only):

- Preferred: `AMADEUS_API_KEY` / `AMADEUS_API_SECRET`
- Aliases: `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`
- Base URL default: `https://test.api.amadeus.com`

## Search flow

1. OAuth token acquire / cache
2. `GET /v2/shopping/flight-offers`
3. Normalize offers → Rahhal flight model + Decision Engine offer shape
4. Retry on 429 / 5xx / network / timeout via Sprint 90 RetryPolicy
5. Circuit breaker opens after repeated failures; registry can failover to mock

Airport lookup: `GET /v1/reference-data/locations` (AIRPORT,CITY).

## Normalization

Standardizes:

| Field | Source |
|-------|--------|
| Flights | Offer itineraries / segments |
| Prices | `price.total` / `grandTotal` |
| Duration | ISO-8601 `PT…H…M` |
| Stops | segment count − 1 |
| Cabins | traveler fare details + cabin map |
| Airlines | carrier code → display name map |
| Airports | IATA origin/destination |
| Currencies | ISO-4217 uppercased |
| Availability | `numberOfBookableSeats` → available / limited / unknown |
| Passengers | adults / children normalization |

## Error recovery

Maps HTTP / network failures through `classifyProviderFailure`:

- 401 Unauthorized (token retry first)
- 403 Forbidden
- 404 Not found
- 429 Rate limited (retryable)
- 5xx Server errors (retryable)
- Timeouts / network failures (retryable)

Traveler-facing recovery remains the responsibility of higher layers (Alpha / Conversation). This provider returns structured `ProviderSearchResult` errors only.

## Feature flag

`providers.amadeus.enabled`

| Context | Default |
|---------|---------|
| Sandbox / non-production | **ON** |
| Production (`VITE_DEPLOY_TARGET=production`) | **OFF** |

Override: `PROVIDERS_AMADEUS_ENABLED` / `VITE_PROVIDERS_AMADEUS_ENABLED`

Verify: `npm run amadeus-sandbox:verify`

## Observability

Events (no secrets):

- `provider.request`
- `provider.response`
- `provider.failure`
- `provider.retry`
- `provider.success`
- `provider.latency`
- `provider.token.refresh`

## Known sandbox limits

- Amadeus **test** inventory is sparse and route-dependent
- No hotel / package APIs in this sprint
- Rate limits are stricter than production
- Some airport codes may return empty offers (not a platform failure)
- OAuth tokens expire (~30 minutes); refresh is automatic
- Live `api.amadeus.com` stays disabled unless explicitly forced via env

## Testing

`src/lib/__tests__/amadeusSandbox.sprint92.test.ts` — OAuth, refresh, flight search, normalization, failures, retry, circuit breaker, registry failover, feature flag, sandbox responses (injectable fetch, no live network).
