# Sprint 93 — Unified Travel Intelligence Layer

**Type:** Additive composition layer (`src/core/trip` + agent bridge)  
**Depends on:** Packages (83) · Refinement (84) · Decision (79) · Price Intelligence (81) · Providers (90+)

## Goal

When Rahhal receives a travel request it produces **one unified `Trip` object** — a presentation-ready travel plan — instead of exposing isolated provider / engine outputs.

## Architecture

```
Conversation → Constitution → Intent → Search Planner
        ↓
Amadeus Flights (or mock offers)
Hotels / Activities / Transfers / Visa / Insurance (live or placeholders)
        ↓
Price Intelligence → Package Builder → Itinerary Refinement → Decision Engine
        ↓
TripComposer  ← Sprint 93
        ↓
Unified Trip Response
```

RahhalBrain and all listed engines remain unchanged. TripComposer **reads** their outputs and composes; it does not reimplement scoring, ranking, or provider IO.

## Modules (`src/core/trip`)

| Module | Role |
|--------|------|
| `TripComposer` | Orchestrates composition into one `Trip` |
| `TripNormalizer` | Provider/package adapters → Trip segments |
| `TripCostCalculator` | Flight/hotel/transfer/activity/insurance/visa + taxes/fees/total |
| `TripTimelineBuilder` | Outbound → arrival → check-in → activities → return |
| `TripSummaryBuilder` | Executive / traveler / budget / recommendation summaries |
| `TripValidator` | Missing flights, dates, timeline, pricing, currency |
| `TripConfidence` | Combines provider + price + decision + package confidence |
| `TripAlternativeBuilder` | Cheaper / faster / luxury / balanced |
| `TripSerializer` | JSON + compact summary card |

Placeholders fill hotels, transfers, activities, visa, and insurance when live providers are absent.

## Unified `Trip` object

Contains: destination, dates, travelers, flights, hotel, activities, transfers, insurance, visa, budget, currency, confidence, recommendation, warnings, alternatives, timeline, pricingSummary, plus `summary` and validation flags.

## Feature flag

`ai.unified_trip` (default **ON**, depends on dynamic packages + itinerary refinement)

Verify: `npm run unified-trip:verify`

## Agent bridge

`runUnifiedTrip` / `enrichWithUnifiedTrip` map memory + package/refinement/decision/price outputs into `TripComposeRequest`.

## Testing

`src/lib/__tests__/unifiedTrip.sprint93.test.ts` — normalizer adapters, pricing, timeline, confidence, alternatives, validation, serialization, composer E2E, feature flag.

## Notes

- Additive only — Constitution, Conversation, Decision, Learning, Price Intelligence, Packages, Refinement, Alpha Experience, Provider Readiness, and Amadeus Sandbox modules are not modified.
- No duplicated business logic — confidence/prices/alternatives are aggregated from existing engine results.
