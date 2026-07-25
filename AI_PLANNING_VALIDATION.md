# Planning Validation — Phase 7 Stage 7

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `PlanningValidationContract` / `PlanningValidation` | `valid: true`, empty issues |
| `PlanningConfidence` | `bandHint: 'medium'`, `scoreHint: 0` |
| `TravelPlan.books` | `false` |
| `PlanningEngineContract.books` | `false` |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoRuntime` | false |
| `wiredIntoLlms` | false |
| `booking` | false |
| `pricing` | false |
| `wiredIntoExternalApis` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `businessLogic` | false |
| `distinctFromPhase6PlanningEngine` | true |

Force blueprint: `tryBuildTravelPlanningBlueprint({ enabled: true })`.
