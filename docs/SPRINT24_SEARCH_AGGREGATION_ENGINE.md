# Sprint 24 — Search Aggregation Engine

Aggregates Sprint 23 execution/provider results into normalized, ranked travel recommendations. Mock providers only — no live supplier or map APIs.

## Non-goals (strict)

- No Amadeus / Booking.com / Google / Maps / OpenAI / Azure / ElevenLabs
- No changes to Sprint 19–23 behavior when `brain.search` is OFF
- Keep current mock provider adapters; no live calls

## Pipeline

```
Conversation
  → Brain
  → TripPlanningEngine (Sprint 22)
  → TravelExecutionEngine (Sprint 23)
  → SearchAggregationEngine (Sprint 24)
  → Recommendations
```

```
ExecutionPlan
  → Execution Tasks
  → Search Providers (mock)
  → Normalized Results
  → Deduplicate
  → Ranking / Scoring
  → Recommendation Engine
```

Text (`planTurn`) and voice (`commitUserUtterance` + `awaitPendingExecution`) share `runIntegratedBrainPipeline` / `attachSearchAggregation`.

## Provider interfaces (unchanged)

`FlightProvider` · `HotelProvider` · `TransportProvider` · `ActivitiesProvider` · `PackageProvider`

## Normalized models

| Type | Role |
|------|------|
| `FlightOption` | Normalized flight offer |
| `HotelOption` | Normalized hotel offer |
| `TransportOption` | Normalized transfer/transport |
| `ActivityOption` | Normalized activity |
| `PackageOption` | Normalized package bundle |
| `SearchResult` | Scored option + factors + reject flags |
| `SearchCollection` | Aggregated options by kind |
| `RecommendationCandidate` | Top / alt / rejected candidate |
| `SearchRecommendation` | Top + alternatives + rejected + reasoning + confidence |

## Aggregation pipeline

Provider Results → Normalize → Deduplicate → Ranking → Scoring → Recommendation List

### Ranking factors

Price · Travel duration · Stops · Hotel rating · Location · Budget fit · Preference match · Trip goals

### Recommendation output

- Top Recommendation
- Alternatives
- Rejected Results
- Reasoning
- Confidence Score

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_search` | `brain.search` | `brain.execution` |

## Debug UI

`SearchViewer` inside `ConversationDebugPanel` — provider calls, aggregation, ranking, scoring, recommendation, execution timeline.

## Modules

`src/lib/brain/search/`

## Tests

`src/lib/__tests__/searchAggregationEngine.sprint24.test.ts`
