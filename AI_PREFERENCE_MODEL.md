# Preference Model — Phase 7 Stage 3 (architecture)

## Contracts

| Contract | Role |
|----------|------|
| `PreferenceLearningContract` | Learning keys (empty) |
| `PreferenceConfidenceContract` | `bandHint: 'medium'` |
| `PreferenceRankingContract` | Ranked preference keys |
| `InterestDetectionContract` | Interest hints |
| `BudgetAwarenessContract` | Currency/band hints |
| Favorite rankings | Destination · Activity · Hotel · Airline · Restaurant |

## Profile linkage (hints only)

`PersonalizationProfileContract` sets:

- `linkedTravelerProfileHint: true` → Phase 7 Stage 1 foundation  
- `linkedLoyaltyHint: true` → Phase 7 Stage 2 foundation  

No persistence, no preference writes, no learning loops.
