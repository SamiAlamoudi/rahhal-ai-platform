# Reward Engine — Phase 7 Stage 2 (architecture)

**There is no reward calculation in this stage.**

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `RewardPointsContract` | `balanceHint: 0`, `calculated: false` |
| `PointLedgerContract` | empty entries, `persisted: false` |
| `PointExpirationStrategyContract` | `policyHint: 'none_architecture'` |
| `RewardCatalogContract` | placeholder entry, `availableHint: false` |
| `RewardRedemptionContract` | `executed: false` |
| `TravelCreditsContract` | `balanceHint: 0`, `calculated: false` |
| `CouponsContract` | `logic: false` |
| `LoyaltyWalletContract` | instrument hints only |

## AI reward contracts

| Contract | Role |
|----------|------|
| `RewardRecommendationContract` | Recommendation key placeholders |
| `OfferPersonalizationContract` | Offer key placeholders |
| `RewardEligibilityContract` | Deny-by-default rule hint |

No ledgers are persisted; no redemptions execute; no payments fire.
