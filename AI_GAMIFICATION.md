# Gamification — Phase 7 Stage 2 (architecture)

## Contracts

| Contract | Role |
|----------|------|
| `TravelAchievementsContract` | Achievement hints (empty in blueprints) |
| `BadgesContract` | Badge hints |
| `MilestonesContract` | Milestone hints |
| `GamificationStrategyContract` | Strategy hints: badges / milestones / achievements |
| `ReferralProgramContract` | `activeHint: false` |
| `CampaignRegistryContract` | Campaign keys; `enabledHint: false` |
| `CampaignDecisionContract` | Decision hints (empty) |

## Timeline

`RewardTimelineContract` seeds a single `account_opened` event.  
No live campaigns, badge grants, or referral payouts.
