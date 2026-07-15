# AI Trip Planner Pipeline (Phase AF)

Unified application-level orchestration for the Rahhal AI trip-planning flow.

## Purpose

`TripPlannerService` coordinates existing engines without duplicating their domain logic:

1. **PreferenceEngine** — normalize explicit/inferred preferences and weights
2. **RecommendationEngine** — score, explain, and rank candidates
3. **ItineraryEngine** — generate day-by-day itineraries and optimization results
4. **BookingOrchestrator** — optional **mock booking preview** only

## Pipeline stages

| Stage | Description |
|---|---|
| `Received` | Request accepted and correlating execution created |
| `Validating` | Canonical validation of dates, destinations, budget, constraints |
| `PreferencesPrepared` | PreferenceEngine normalization + source attribution |
| `RecommendationsGenerated` | RecommendationEngine.recommendV1 |
| `ItineraryGenerated` | ItineraryEngine.generate |
| `BookingPreviewGenerated` | BookingOrchestrator draft + validate + reserve readiness (optional) |
| `Completed` | Successful terminal state |
| `Failed` | Terminal failure (may include partial prior-stage outputs) |
| `Cancelled` | AbortSignal / cooperative cancellation |

Each stage emits a timestamped `TripPlannerPipelineEvent`.

## Safe defaults

- Mock payment only — booking preview **never** captures payment or confirms a booking
- Live providers remain OFF
- `includeBookingPreview=false` by default (no BookingOrchestrator call)
- In-memory repositories only in this phase
- PII/secrets masked in event details and metrics tags

## Failure behavior

- Failures identify the failed stage and a correlation ID
- Prior successful stage outputs are preserved when safe (partial results)
- Booking preview failures do not keep a partial booking preview
- Cancellation clears booking preview / itinerary side effects from the result
- Retryable flags are returned for timeouts and selected engine failures

## Idempotency

`idempotencyKey` prevents duplicate pipeline execution:

- Completed/failed/cancelled results are stored and returned on repeat
- In-flight duplicates with the same key are rejected with a retryable conflict

## Observability

Provider-neutral metrics (local trip-planner registry + ops idempotency bridge):

- total pipeline duration
- stage duration
- stage failures
- partial-result rate
- booking-preview usage
- confidence distribution
- cancellation count
- idempotency hits

## Extension points (future)

- Swap in-memory repositories for durable stores without changing service contracts
- Attach live ProviderAdapters behind existing engine boundaries (not in TripPlannerService)
- Enable real booking confirmation only through explicit future booking APIs — never automatically from this pipeline

See also: `TRIP_PLANNER_CONTRACT.md`.
