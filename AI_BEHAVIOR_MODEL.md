# Behavior Model — Phase 7 Stage 3 (architecture)

## Contracts

| Contract | Role |
|----------|------|
| `BehaviorLearningContract` | Behavior signal keys (empty in blueprints) |
| `TravelPatternAnalysisContract` | Pattern hints |
| `IntentPredictionContract` | Intent hints; `predicted: false` |
| `DynamicUserSegmentsContract` | Segment hints |
| `TravelerPersonasContract` | Persona hints |
| `TravelHistoryAnalysisContract` | History keys |
| `SeasonalityModelContract` | Season hints |
| `LocationAwarenessContract` | Location keys |
| `CompanionAwarenessContract` | Companion hints |

No telemetry ingestion, no ML training, no live prediction.
