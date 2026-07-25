# Recommendation Scoring — Phase 7 Stage 9

**Source:** `TRAVEL_RECOMMENDATION_SCORE_DIMENSIONS` · `RecommendationScoringContract`

## Score dimensions (hints)

| Dimension | Role |
|-----------|------|
| `profile_fit` | Traveler profile alignment |
| `intent_fit` | Intent alignment |
| `preference_fit` | Preference alignment |
| `budget_fit` | Budget alignment |
| `goal_fit` | Planning goals alignment |
| `constraint_fit` | Travel constraints alignment |
| `history_fit` | Historical signals alignment |
| `business_rule_fit` | Business rules alignment |

## Blueprint defaults

| Contract | Defaults |
|----------|----------|
| `RecommendationScoringContract` | `scores: []`, `executed: false`, `execution: 'none'` |
| `RecommendationScore` (sample) | `scoreHint: 0`, dimensionHints listed above |

**No scoring algorithms execute.** Distinct from Stage 3 personalization `RecommendationScoringContract` (different package / flag).
