# Search Ranking — Phase 7 Stage 8

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `SearchRankingContract` / `SearchRanking` | empty orderedCandidateIds |
| `SearchScore` | `scoreHint: 0` |
| `SearchNormalizationContract` | provider_agnostic_placeholder |
| `SearchAggregationContract` | merge_by_provider_kind; `executed: false` |
| `SearchStrategyContract` | prepare_only · never_call_providers · unify_request_shape |
| `SearchConfidenceContract` | `bandHint: 'medium'`, `scoreHint: 0` |

Ranking/aggregation are declarative hints only — no candidate scoring runs.
