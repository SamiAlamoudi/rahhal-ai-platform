# Offer Ranking — Phase 7 Stage 10

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `OfferRankingContract` / `OfferRanking` | empty orderedCandidateIds |
| `OfferDecision` | `selectedCandidateId: null`, `selectedBundleId: null`, strategyHint `best_overall` |
| `OfferBundle` | empty candidateIds |
| `OfferConfidenceContract` | `bandHint: 'medium'`, `scoreHint: 0` |

Ranking/selection are declarative hints only — no offer ranking runs at this stage.
