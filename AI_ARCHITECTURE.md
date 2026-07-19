# AI Architecture — Phase AB Foundation

## Principles

1. **Additive only** — do not break `TripPlan`, `applyIntelligentDecisions`, booking/payment, or `ProviderAdapter` contracts.
2. **Layered** — agent (planning execution) ≠ ai (enhancement interfaces) ≠ ops (infra metrics).
3. **Privacy first** — personalization/analytics respect settings gates; PII masking via ops helpers.
4. **Deterministic foundations** — Phase AB engines are interface + deterministic helpers (no new LLM provider).
5. **ProviderAdapter preserved** — live search remains Phase W aggregation; AI ranking overlays scored candidates.

## Package map

```
src/lib/ai/
  featureFlags/     FeatureRegistry (product lifecycles)
  preferences/      PreferenceEngine + PersonalizationProfile
  ranking/          RankingEngine
  recommendations/  RecommendationEngine
  planning/         multi-destination, alternatives, confidence, explanations
  analytics/        anonymous ProductAnalytics
  index.ts

src/lib/concierge/          Sprint 9 Conversation Intelligence (above agent)
```

Related (unchanged ownership):

```
src/lib/agent/              TripPlan, decision engine, aggregation, tools
src/lib/agent/aggregation/  ProviderAdapter + Phase W live flags
src/lib/ops/                infra metrics, masking, incidents (Phase AA+)
src/lib/trips/              ManagedTrip / TravelerProfile (PII passengers)
src/lib/settings/           privacy_analytics / privacy_personalization gates
```

## Concierge layer (Sprint 9)

- Sits **above** `travelAgentService` — consultant dialogue, not provider routing.
- **Provider-agnostic:** no Amadeus/Duffel/Travelport/Sabre/Booking/Expedia imports or selection.
- Speaks only to agent abstractions; handoff modes are `plan | search | refine | none`.
- Flag: `ai.concierge`. See `docs/CONCIERGE.md`.

## Flight Results Experience (Sprint 11)

- UI/logic for premium flight cards, sort/filter, details, and select→booking session.
- Package: `src/lib/flightResults` + `src/components/flightResults`.
- Recommendation banner reuses Concierge `buildConsultantReply` (no hardcoded result copy).
- Flag: `ui.flight_results_experience` (depends on `ai.concierge`).
- See `docs/SPRINT11_RESULTS.md` and `docs/LIVE_PROVIDER.md`.

## Engines (interfaces)

| Engine | Responsibility |
|--------|----------------|
| `PreferenceEngine` | Read/upsert personalization profiles; apply privacy gate |
| `RankingEngine` | Weighted rank of candidates → `rankScore` + confidence + explanation |
| `RecommendationEngine` | Select primary + alternatives with explainable output |

## Planning enhancements

| Capability | API |
|------------|-----|
| Multi-destination | `buildMultiDestinationOutline` |
| Alternative itineraries | `generateAlternativeItineraries` |
| Confidence scoring | `scorePlanningConfidence` |
| Explainable recommendations | `buildExplainableRecommendation` / RecommendationEngine |
| Preference weighting | `applyPreferenceWeighting` + profile `weights` |

These helpers **do not** mutate existing `TripPlan` shape. Future wiring may attach results as optional enrichment (same pattern as `TripPlan.decision?`).

## Analytics

`ProductAnalytics` tracks anonymous session metrics:

- recommendation shown / accepted → acceptance rate
- itinerary started / completed → completion rate
- booking funnel view → hold → payment → ticket → complete

Metadata is masked (`maskMetadata`). Recording is skipped when `analyticsAllowed` is false.

## Compatibility matrix

| Contract | Phase AB impact |
|----------|-----------------|
| `TripPlan` core fields | Unchanged |
| `applyIntelligentDecisions(...)` | Unchanged signature |
| Phase W provider flags | Unchanged; separate from FeatureRegistry |
| `VITE_PAYMENT_PROVIDER=mock` | Preserved; `payments.live` registry flag OFF |
| ProviderAdapter architecture | Preserved |

## Out of scope here

- UI redesign / new customer-facing screens
- Live payment enablement
- Renaming Rahhal / package identity
