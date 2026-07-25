# Offer Schema — Phase 7 Stage 10

**Source:** output contracts in `src/lib/orchestration/travelOfferDecisionEngine/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `OfferCandidate` | candidateId · sourceRecommendationHint · labelHint · `execution: 'none'` |
| `OfferBundle` | bundleId · candidateIds · labelHint |
| `OfferDecision` | decisionId · selectedCandidateId · selectedBundleId · strategyHint |
| `OfferRanking` | rankingId · orderedCandidateIds |
| `OfferScore` | candidateId · scoreHint · dimensionHints |
| `OfferExplanation` | explanationId · decisionId · reasonHints |
| `OfferConfidence` | decisionId · scoreHint · bandHint |
| `OfferValidation` | decisionId · valid · issues |
| `OfferRevision` | revisionId · decisionId · reasonHint |
| `OfferSnapshot` | snapshotId · atIso · decisionId |

## Input hints

`recommendation_results` · `traveler_preferences` · `price_signals` · `quality_signals` · `business_rules` · `decision_strategy`

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
