# Travel Planning Schema — Phase 7 Stage 7

**Source:** output contracts in `src/lib/orchestration/travelPlanningEngine/types.ts`  
**Flag:** `brain.travel_planning`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `TravelPlan` | planId · destinationHint · dateHints · budgetHint · `books: false` |
| `PlanningGoal` | goalId · goalHint |
| `PlanningConstraint` | constraintId · constraintHint · hardHint |
| `PlanningStep` | stepId · stageHint · summaryHint |
| `PlanningAlternative` | alternativeId · labelHint |
| `PlanningScore` | planId · scoreHint |
| `PlanningConfidence` | planId · scoreHint · bandHint |
| `PlanningValidation` | planId · valid · issues |
| `PlanningRevision` | revisionId · planId · reasonHint |
| `PlanningSnapshot` | snapshotId · atIso · planId · versionHint |

## Input hints (upstream references)

`traveler_profile` · `conversation_context` · `intent` · `preferences` · `budget` · `dates` · `destination`

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
