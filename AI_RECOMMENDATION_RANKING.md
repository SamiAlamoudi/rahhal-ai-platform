# Recommendation Ranking — Phase 7 Stage 9

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `RecommendationRankingContract` / `RecommendationRanking` | empty orderedCandidateIds |
| `RecommendationStrategyContract` | rank_only · never_book · never_call_providers · prefer_constraints_over_suggestions |
| `TopRecommendation` | `candidateId: null` |
| `AlternativeRecommendation[]` | empty |
| `RecommendationExplanationContract` | empty reasons |
| `RecommendationConfidenceContract` | `bandHint: 'medium'`, `scoreHint: 0` |

Ranking is declarative ordering hints only — no candidate ranking runs at this stage.
