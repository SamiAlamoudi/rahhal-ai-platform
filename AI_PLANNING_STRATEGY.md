# Planning Strategy — Phase 7 Stage 7

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `PlanningStrategyContract` | structure_only · never_book · prefer_constraints_over_suggestions |
| `PlanningGoalsContract` | structure_trip_blueprint goal sample |
| `PlanningLifecycleContract` | draft · structure · revise · validate · snapshot · close |
| `PlanningOptimizationContract` | schedule/budget hints; `executed: false` |
| `PlanningAlternativesContract` | empty alternatives in blueprints |
| `PlanningVersionContract` | `version: 0` |
| `PlanningRevisionContract` | empty revisions; `persisted: false` |

Strategy is declarative metadata only — no optimizer runs, no bookings.
