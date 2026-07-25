# Preference Confidence — Phase 7 Stage 4

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `PreferenceConfidenceModelContract` | `modelHint: 'architecture_placeholder'` |
| `PreferenceConfidenceScoreContract` | empty `scores` |
| `PreferenceConfidence` (output) | score/band hints; unused in empty blueprints |
| `PreferenceWeightingContract` | weight `0` per category |
| `PreferenceFreshnessModelContract` | `freshnessBandHint: 'unknown'` |
| `PreferenceExpirationContract` | `policyHint: 'none_architecture'` |

No scoring algorithms, no ML, no live confidence meters.
