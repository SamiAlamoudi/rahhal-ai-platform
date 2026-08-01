# Sprint 87 — Live Brain Experience (Preview Only)

**Branch:** `cursor/sprint87-live-brain-71ec`  
**Continues from:** Sprint 86 Brain Preview Integration  
**Flags:**
- `ai.brain.v1` — **OFF**, remains in `RECOVERY_FROZEN_OFF_FLAGS`
- `ai.brain.v1.preview` — **OFF by default**, not frozen; production hard-blocked

**Turn owner:** `travelAgentService.planTurn` (unchanged)

## Goal

Transform Brain Preview from orchestration into a real travel consultant — **conversation quality only**. No production rollout.

## Architecture (no redesign)

```text
User Input
  → travelAgentService.planTurn()
       ├─ preview OFF → Current Planner
       └─ preview ON
            → BrainRouter
                 → ConversationManager
                      → TravelPlanningEngine (incremental slots)
                      → AssumptionEngine
                      → ValueFirstPlanner ← destinationInsights
                      → TravelReasoner (season/weather/style/costs)
                      → ClarificationPolicy (budget ≤ 1)
                      → ResponseGenerator (value → assumptions → one Q)
                 → fallback on exception / empty
```

## Destination Knowledge layer (data-driven)

```text
src/lib/brain/v1/destinationKnowledge/
  types.ts                 — DestinationKnowledge schema
  registry.ts              — register / resolve aliases
  reasonFromKnowledge.ts   — rank cities + compose value from scores
  data/<country>.ts        — insert-only destination records
```

Each record exposes: country, cities, best season, climate, average budget, trip duration,
family/honeymoon/business scores, beaches, mountains, nightlife, shopping, culture,
transportation, visa notes, airport information.

**City recommendations are derived from scores + trip style** — not hardcoded essays.
Add a future country by creating `data/<key>.ts` and registering it in `data/index.ts`.

## What changed

| Area | Change |
| --- | --- |
| Destination Knowledge | Reusable registry + reasoner (Morocco/Agadir/Japan/London/Dubai/Switzerland) |
| ValueFirstPlanner | Composes value from `reasonFromDestinationKnowledge` |
| EntityExtractor | Agadir/Switzerland + refine cues (`actually make it…`) |
| Slot memory tags | `tripStyle`, `preferredCity`, `food`, `hotelLevel`, `transport`, `visaInterest` |
| TravelReasoner | `destination_reasoning` + `trip_style_reasoning` steps |
| BrainRouter | Destination overwrite on refine; preference soft-defaults from AgentMemory |
| Clarification | Still max **1** question; never re-ask known slots |

## Demo scenarios

See `docs/SPRINT87_DEMO_TRANSCRIPTS.md`.

1. Morocco — value first  
2. Japan — long-haul reasoning  
3. Business trip London  
4. Weekend Dubai  
5. Family Switzerland  
6. Morocco → Agadir incremental update  

## Guardrails

- No production enable
- No UI / Voice redesign
- No booking / payments
- Estimates labeled preliminary / indicative — never live quotes
- Fabrication of availability/schedules forbidden

## Verify

```bash
npm run brain-live:verify
npm run brain-preview:verify
npm run brain-conversation:verify
npm run brain-v2:verify
npm run typecheck && npm run lint && npm run build
```

## Risk report

| Risk | Mitigation |
| --- | --- |
| Richer replies feel “hardcoded” | Insights are structured modules; ResponseGenerator composes from slots/style |
| Arabic length growth | Soft trim in ResponseGenerator; Sprint 85 length assertion retained |
| Destination refine steals origin cities | Refine requires cue / bare short message; “from” protects origin |
| Preview accidentally ON in prod | Deploy-target hard block unchanged from Sprint 86 |
| Incremental update regenerates plan | PlanRevision keeps `planId`; only changed slots in `revisedSlots` |
