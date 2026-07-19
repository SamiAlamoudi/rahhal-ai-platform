# Sprint 22 — Multi-Step AI Trip Planning Engine

Upgrades Rahhal from a conversation engine into a complete travel planning engine. The Brain converts natural conversation into a structured travel plan that can drive the booking workflow.

## Non-goals (strict)

- No OpenAI / Azure / ElevenLabs / other external AI providers
- No live supplier booking from the planner (structured plans only)
- No breaking changes when `brain.trip_planning` is OFF

## Architecture

```
User (text OR speech)
        │
        ▼
runIntegratedBrainTurn  (shared text + voice)
        │
        ├─ ConversationOrchestrator (Sprint 19–21)
        │
        └─ TripPlanningEngine  (Sprint 22, when brain.trip_planning ON)
              Stage 1  Collect known information
              Stage 2  Detect missing information
              Stage 3  Generate smallest clarification (exactly one question)
              Stage 4  Update memory (PlanningSession)
              Stage 5  Produce complete TripPlan
        │
        ▼
TripPlan + ClarificationPlan + TravelSummary
```

## Planning Session

Durable object across turns:

destination, departure city, travel dates, flexibility, traveler count, adults / children / infants, cabin class, hotel preferences, room requirements, transportation, activities, budget, airline preferences, notes.

## Corrections (no restart)

Examples that update **only** the changed fields:

| User says | Effect |
|-----------|--------|
| "I actually want Kyoto instead of Tokyo." | destination only |
| different dates | travelDates only |
| more travelers | traveler counts only |
| better hotel | hotel preferences |
| higher budget | budget amount |
| cheaper flight | notes + transportation preference |

## Structured outputs

| Type | Role |
|------|------|
| `TripPlan` | Engine plan; embeds agent `TripPlan` when complete for booking |
| `ClarificationPlan` | Single follow-up question when a required slot is missing |
| `TravelSummary` | Known / missing slots + completeness |

## Feature flags (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_trip_planning` | `brain.trip_planning` | `brain.travel_engine` |

Parent chain: `brain.enabled` → `brain.concierge` → `brain.travel_engine` → `brain.trip_planning`.

## Modules

`src/lib/brain/tripPlanning/`

| File | Role |
|------|------|
| `tripPlanningEngine.ts` | Stage machine |
| `planningSession.ts` | PlanningSession CRUD |
| `correctionDetector.ts` | Natural corrections |
| `missingDetector.ts` | Missing slots (never re-ask) |
| `clarification.ts` | One-question ClarificationPlan |
| `produceTripPlan.ts` | TripPlan production |
| `travelSummary.ts` | TravelSummary |

## Compatibility

- Flags OFF → Sprint 19–21 behavior unchanged
- Voice and text share `runIntegratedBrainTurn` → same planning pipeline
- Sprint 21 brain `TravelPlan` remains distinct from engine `TripPlan` (import as `EngineTripPlan` from `@/lib/brain`)

## Tests

`src/lib/__tests__/tripPlanningEngine.sprint22.test.ts`
