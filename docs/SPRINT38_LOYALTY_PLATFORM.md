# Sprint 38 — Universal Loyalty, Rewards & Membership Platform

Platform-wide Rahhal Points wallet, membership tiers, benefits, airline/hotel loyalty adapters, and smart rewards recommendations across every travel service.

## Non-goals

- Do not rewrite planner, execution, payments, refunds, or disruption engines
- Hotel/airline adapters are sandbox estimators — no live loyalty SDKs
- Money movement remains in the payments platform; points are a parallel rewards ledger

## Architecture

```
Conversation / booking signals
  → LoyaltyPlatform
       ├─ PointsWallet (earn/redeem/expire/reverse/bonus/promo/campaign/transfer/adjust)
       ├─ MembershipEngine (Explorer → Diamond)
       ├─ BenefitsEngine (support, upgrades, lounge, discounts, late checkout, …)
       ├─ AirlineLoyaltyStore (member numbers, miles, best airline)
       ├─ HotelLoyaltyRegistry (Hilton/Marriott/IHG/Accor/Hyatt/Best Western + generic)
       ├─ LoyaltyRecommendationEngine (price/points/benefits/prefs/history/context)
       └─ LoyaltyExplainer + Events + Metrics
```

## Membership levels

Explorer · Silver · Gold · Platinum · Diamond

## Conversation examples

- "Use my Rahhal points."
- "Which hotel gives me the most rewards?"
- "Can I upgrade using points?"
- "How many points will I earn?"

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.loyalty_platform` | **OFF** | `brain.travel_disruption_engine` |

## Modules

`src/lib/loyalty/`

## Tests

`src/lib/__tests__/loyaltyPlatform.sprint38.test.ts`
