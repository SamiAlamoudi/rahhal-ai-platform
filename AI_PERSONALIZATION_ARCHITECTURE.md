# Personalization Architecture — Phase 7 Stage 3

## Layers

| Layer | Contracts |
|-------|-----------|
| Engine | `PersonalizationEngineContract` · Profile |
| Learning | Preference · Behavior · Travel patterns · Intent |
| Context | Recommendation context · Personalization context |
| Segmentation | Dynamic user segments · Traveler personas |
| Preference quality | Confidence · Ranking · Interest detection |
| Awareness | Seasonality · Location · Budget · Companion |
| History | Travel history analysis · Favorite rankings |
| Scoring | Recommendation scoring · Feedback |
| Ops | Timeline · Audit trail |
| AI capabilities | Destination/Hotel/Activity/Restaurant/Transport/Tone/Offer |

## Source hints (declarative)

Profile · Loyalty · Conversations · Behavior · History · Context

## Isolation

`PERSONALIZATION_ENGINE_ISOLATION` asserts **false** for LLMs, recommendation execution, DB, Runtime, streaming, HTTP, auth, APIs, and business logic. Distinct from legacy `ai.personalization` / `ai.recommendation_engine`.
