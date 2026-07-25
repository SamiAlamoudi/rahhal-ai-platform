# Recommendation Schema — Phase 7 Stage 9

**Source:** output contracts in `src/lib/orchestration/travelRecommendationEngine/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `RecommendationCandidate` | candidateId · sourceSearchCandidateHint · labelHint · `execution: 'none'` |
| `RecommendationScore` | candidateId · scoreHint · dimensionHints · `execution: 'none'` |
| `RecommendationRanking` | rankingId · orderedCandidateIds |
| `RecommendationReason` | reasonId · candidateId · reasonHint |
| `RecommendationConfidence` | candidateId · scoreHint · bandHint |
| `RecommendationValidation` | rankingId · valid · issues |
| `RecommendationSnapshot` | snapshotId · atIso · rankingId |
| `RecommendationRevision` | revisionId · rankingId · reasonHint |
| `TopRecommendation` | candidateId · labelHint |
| `AlternativeRecommendation` | candidateId · labelHint |

## Input hints

`normalized_search_candidates` · `traveler_profile` · `conversation_context` · `intent` · `preferences` · `budget` · `planning_goals` · `travel_constraints` · `historical_signals` · `business_rules`

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
