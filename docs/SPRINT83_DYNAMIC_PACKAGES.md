# Sprint 83 — AI Dynamic Travel Packages

**Type:** Additive package composition layer (`src/core/packageBuilder` + agent bridge)  
**Depends on:** Price Intelligence (81) · Adaptive Learning (80) · Decision Engine (79)

## Goal

Build complete travel packages from normalized offers (flight, hotel, transfer, activities, insurance, lounge, eSIM; visa-ready optional), filter incompatibilities, score/rank/explain, and feed Decision Engine via prioritized offer pools — **without** changing Decision Engine public contracts or redesigning RahhalBrain.

## Architecture

```
Conversation
    ↓
Strategy Planner
    ↓
Search
    ↓
Offer Aggregation
    ↓
Package Builder
    ↓
Package Optimizer
    ↓
Decision Engine          ← consumes reordered offer pools (no API change)
    ↓
Adaptive Learning        ← may re-rank packages via preference biases
    ↓
Price Intelligence       ← soft score enrichment (timing confidence)
    ↓
Recommendation
```

## Decision flow

1. Normalize flight/hotel/(optional) transfer/activity/addon offers  
2. Generate candidates in parallel (flight shards)  
3. Compatibility Engine rejects invalid combinations  
4. Score dimensions in parallel; apply learning biases + price-timing boost  
5. Optimize: dedupe → prune weak → keep top  
6. Rank with labels; lazy-explain labeled packages only  
7. Bridge reorders offer pools so Decision Engine sees package-preferred options first  

## Package generation

Each package may include:

| Component | Required |
| --- | --- |
| Flight | yes |
| Hotel | yes |
| Transfer | optional |
| Activities | optional |
| Insurance / Lounge / eSIM | optional |
| Visa | optional (integration-ready) |

## Ranking labels

Best Overall · Best Budget · Best Business · Best Family · Best Luxury · Best Weekend · Best Value

## Confidence

`0.00–1.00` from completeness, offer/provider quality, score quality, cancellation flexibility, and traveler-fit proxies.

## Explainability

Lazy `Recommended because:` bullets (saved amount, direct flight, hotel rating, breakfast, transfer, flexible cancellation, walkability, …).

## Performance

- Parallel candidate generation (`Promise.all` by flight)  
- Parallel scoring  
- Parallel optimize entrypoint  
- Lazy explanation only for labeled/selected packages  
- Candidate caps (`maxCandidates`) to bound allocations  

## Feature flag

`ai.dynamic_packages` (default **ON**, depends on `ai.price_intelligence`)

Verify: `npm run package:verify`

## Observability

`package.created` · `package.scored` · `package.filtered` · `package.ranked` · `package.selected`

## Testing

`src/lib/__tests__/packageBuilder.sprint83.test.ts` — 35+ unit tests covering duplicates, incompatibilities, family/luxury/business/budget, ranking, confidence, explanations, parallel generation, transfers/activities, cancellation flexibility, addons, and agent bridge.
