# Offer Scoring — Phase 7 Stage 10

**Source:** `TRAVEL_OFFER_SCORE_DIMENSIONS` · `OfferScoringContract`

## Score dimensions (hints)

| Dimension | Role |
|-----------|------|
| `price_fit` | Price signal alignment |
| `quality_fit` | Quality signal alignment |
| `preference_fit` | Traveler preference alignment |
| `business_rule_fit` | Business rules alignment |
| `bundle_value_fit` | Bundle composition value |

## Blueprint defaults

| Contract | Defaults |
|----------|----------|
| `OfferScoringContract` | `scores: []`, `executed: false`, `execution: 'none'` |
| `OfferScore` (sample) | `scoreHint: 0`, dimensionHints listed above |

**No scoring algorithms execute.** Distinct from Stage 9 recommendation scoring (different package / flag).
