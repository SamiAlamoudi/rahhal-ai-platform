# Recommendation Engine — Phase 7 Stage 3 (architecture)

**There is no recommendation execution in this stage.**

## Scoring & feedback

| Contract | Blueprint defaults |
|----------|-------------------|
| `RecommendationScoringContract` | `executed: false`, empty score hints |
| `RecommendationFeedbackContract` | empty feedback hints |
| `RecommendationContextContract` | source key hints only |

## Capability contracts

| Contract | Role |
|----------|------|
| `DestinationRecommendationContract` | Destination keys (empty) |
| `HotelRecommendationContract` | Hotel keys |
| `ActivityRecommendationContract` | Activity keys |
| `RestaurantRecommendationContract` | Restaurant keys |
| `TransportationRecommendationContract` | Transport keys |
| `ConversationTonePersonalizationContract` | Tone hints |
| `OfferPersonalizationContract` | Offer keys |

Distinct from legacy flag `ai.recommendation_engine` — this package is Phase 7 architecture only.
