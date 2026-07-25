# Knowledge Architecture — Phase 6 Stage 6

## Layers

| Layer | Contracts |
|-------|-----------|
| Engine | `KnowledgeEngineContract` |
| Catalog | Providers · Sources · Documents · Entities · Categories |
| Graph | Nodes · Edges (`KnowledgeGraphContract`) |
| Access | Context · Retrieval · Ranking · Resolution |
| Quality | Validation · Freshness · Confidence · Provenance |
| Ops | Cache (unbacked) · Events · Analytics · Audit · State machine |

## State machine

`idle` → `resolving_sources` → `retrieving` → `ranking` → `validating` → `freshening` → `ready` → `closed`

## Module hints

`knowledge_center` · `memory_center` · `conversation_center` · `decision_center` · `insights_center` · `travel_workspace` · `booking_hub` · `traveler_profile`
