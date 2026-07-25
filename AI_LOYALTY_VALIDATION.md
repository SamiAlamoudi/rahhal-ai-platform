# Loyalty Validation — Phase 7 Stage 2

Architecture validation is declarative via isolation flags and blueprint defaults.

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoDatabase` | false |
| `wiredIntoAuthentication` | false |
| `wiredIntoPayments` | false |
| `couponsLogic` | false |
| `rewardCalculation` | false |
| `wiredIntoRuntime` | false |
| `wiredIntoApis` | false |
| `wiredIntoLlms` | false |
| `businessLogic` | false |

## Blueprint defaults

| Field | Value |
|-------|-------|
| Membership status | `inactive` |
| Points balance hint | `0` |
| Referral program active | `false` |
| Analytics exported | `false` |
| Audit persisted | `false` |
| All `execution` fields | `'none'` |

Force blueprint for inventory checks: `tryBuildLoyaltyPlatformBlueprint({ enabled: true })`.
