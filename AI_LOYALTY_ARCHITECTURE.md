# Loyalty Architecture — Phase 7 Stage 2

## Layers

| Layer | Contracts |
|-------|-----------|
| Account | Loyalty Account · Membership Levels · Membership Status |
| Points | Reward Points · Point Ledger · Point Expiration Strategy |
| Rewards | Catalog · Redemption · Travel Credits · Coupons |
| Registries | Promo · Voucher · Campaign |
| Growth | Referral Program/Rewards · Partner Rewards |
| Gamification | Achievements · Badges · Milestones |
| Wallet / History | Loyalty Wallet · Reward History · Reward Timeline |
| Ops | Audit · Analytics · Insights |
| AI capabilities | Recommendation · Personalization · Eligibility · Campaign Decision · Gamification Strategy |

## Membership levels (catalog)

`explorer` · `voyager` · `navigator` · `ambassador` · `legacy_placeholder`

## Isolation

`LOYALTY_PLATFORM_ISOLATION` asserts **false** for DB, auth, payments, coupons logic, reward calculation, HTTP, streaming, Runtime, APIs, LLMs, and business logic.
