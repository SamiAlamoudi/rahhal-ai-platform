# Planning Context — Phase 6 Stage 3

## PlanningContextContract

| Field | Purpose |
|-------|---------|
| `sessionId` | Links to planning session |
| `locale` | `ar` \| `en` |
| `destinationHints` | Declarative strings |
| `dateHints` | Declarative strings |
| `budgetHints` | Declarative strings |
| `preferenceHints` | Declarative strings |
| `moduleHints` | UI modules that may render plan artifacts |

## Session & state

- `PlanningSessionContract` — opened timestamp + `stateId`
- State machine: `idle` → `collecting_context` → `selecting_destination` → `building_itinerary` → `optimizing_schedule` → `scoring_plan` → `generating_alternatives` → `ready` → `closed`

## Confidence

`PlanningConfidenceModelContract` — score, band, factor labels; never computes live model scores.
