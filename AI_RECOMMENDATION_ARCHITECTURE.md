# Recommendation Architecture — Phase 6 Stage 4

## RecommendationBuilderContract

| Field | Purpose |
|-------|---------|
| `primaryId` | Top alternative id (null in empty blueprint) |
| `runnerUpIds` | Secondary alternatives |
| `summary` | Architecture placeholder text |
| `execution` | Always `'none'` |

## ExplainabilityLayerContract

- Per-alternative `reasons[]`
- Presentation/contract only — no natural-language model

## Audit

`DecisionAuditTrailContract` — append-only entry shapes with `persisted: false`.

## Module hints

Recommendations may surface in `decision_center`, `travel_workspace`, `conversation_center` (declarative only).
