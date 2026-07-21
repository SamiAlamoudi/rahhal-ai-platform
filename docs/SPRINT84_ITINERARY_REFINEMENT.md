# Sprint 84 — Autonomous Itinerary Refinement Engine

**Type:** Additive incremental refinement (`src/core/itineraryRefinement` + agent bridge)  
**Depends on:** Dynamic Packages (83) · Adaptive Learning (80) · Decision Engine (79)

## Goal

Continuously improve generated travel packages from conversation changes **without rebuilding everything from scratch**.

## Architecture

```
Conversation
→ Strategy Planner
→ Search
→ Price Intelligence
→ Package Builder
→ Itinerary Refinement   ← Sprint 84
→ Adaptive Learning (outcomes)
→ Decision Engine        ← consumes refined offer pools only
```

RahhalBrain unchanged. Decision Engine public contracts unchanged.

## Decision flow

1. Detect conversation changes (`RefinementPlanner`)
2. Resolve hard/soft constraints on **impacted** components only
3. Optimize transfers / schedule / activity balance when needed
4. Detect conflicts; generate A/B/C alternatives if hard conflicts remain
5. Explain what changed / why / impact / tradeoffs / confidence
6. Feed preference signals into Adaptive Learning
7. Prioritize refined flight/hotel offers for Decision Engine

## Hard constraints

Budget · Visa · Flight/Hotel availability · Max transfers · Arrival/Departure deadlines · Meetings · Children · Accessibility · Wheelchair · Business travel

## Soft constraints

Walking distance · Luxury · Food · Beach · Shopping · Nature · Nightlife · Museums · Adventure · Weather · Quiet hotels · Room type · Seat preference

## Performance

- Incremental clone + touch set
- No full package regeneration
- Target refinement **&lt; 20 ms**

## Feature flag

`ai.itinerary_refinement` (default **ON**, depends on `ai.dynamic_packages`)

Verify: `npm run refine:verify`

## Observability

`refinement.started` · `refinement.planned` · `refinement.conflict` · `refinement.optimized` · `refinement.alternative` · `refinement.completed`

## Testing

`src/lib/__tests__/itineraryRefinement.sprint84.test.ts` — 40+ unit tests covering budget/traveler/luxury/economy/activities/weather/flights/hotels/conflicts/meetings/accessibility/transfers/confidence/incremental updates/bridge.
