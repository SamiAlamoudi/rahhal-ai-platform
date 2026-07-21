# Sprint 79 — Autonomous Search & Decision Engine

**Type:** Additive decision layer (`src/core` + agent bridge)  
**Depends on:** Travel Strategy Planner (78) · Flight/Hotel Search · Budget · Personalization · Trip Optimizer

## Goal

After Travel Strategy is formed, Rahhal generates **multiple independent search plans**, executes them in parallel against candidate offers, scores every itinerary, and recommends the optimal option with an explanation — not the first available result.

## Architecture (additive)

```
Travel Strategy (Sprint 78)
    ↓
Search Planner → Plans A–E
    ↓ (parallel)
Plan execution against Flight/Hotel offer pools
    ↓
DecisionEngine
    ├── dedupe / normalize
    ├── weighted scoring
    ├── ranking + labels
    └── explainable recommendation
    ↓
Booking Intelligence → Conversation Brain
```

No RahhalBrain redesign. No engine replacement.

## Modules

| Path | Role |
| --- | --- |
| `src/core/searchPlanner/` | Create Plans A–E |
| `src/core/searchScoring/` | Configurable weighted scoring |
| `src/core/searchRanking/` | Labels: Best Overall / Budget / Fastest / Comfort / Family |
| `src/core/decisionEngine/` | Collect → dedupe → score → rank → select |
| `src/core/observability/` | `search.plan.*` / `candidate.*` events |
| `src/lib/agent/autonomousDecision/` | Feature flag + enrich bridge |

## Domain models

`SearchPlan` · `SearchCandidate` · `SearchScore` · `DecisionReason` · `RecommendationBundle`

## Search plans

- **A** cheapest (long layover / nearby airports allowed)
- **B** balanced price/time
- **C** fastest
- **D** premium comfort
- **E** loyalty friendly

## Explainable output

```
I selected Best Overall because:

- saves SAR 420
- only 35 minutes longer
- better hotel
- fewer transfers

Confidence: 94%
```

## Feature flag

`ai.autonomous_decision` (default **ON**, depends on `ai.travel_planner`)

Verify: `npm run decision:verify`

## Performance considerations

- Plan execution uses `Promise.all` (parallel, CPU-bound on mock offers).
- Combinations per plan capped (default 12) for client-side determinism.
- Deduping collapses cross-plan duplicates by `flightId::hotelId`.
- Observability listeners are fire-and-forget and never throw into the decision path.

## Coverage impact

Adds focused unit/ranking/decision/parallel/fallback/dedupe tests under `autonomousDecision.sprint79.test.ts` without changing prior sprint contracts.

## Known limitations

- Plans score against offer pools from existing engines (does not spawn separate live provider sessions unless offers already include multi-provider rows).
- Explanation currency amounts are relative to runner-up within the ranked set.
