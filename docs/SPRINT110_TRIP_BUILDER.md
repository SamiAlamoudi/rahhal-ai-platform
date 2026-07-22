# Sprint 110 — AI Trip Builder (Production)

**Type:** Additive agent bridge (`src/lib/agent/tripBuilder`)  
**Position:** Live Flight Search + Live Hotel Search → **Trip Builder** → Decision Engine → Response Composer

## Architecture

```
Conversation
        ↓
SearchPlanner
        ↓
Live Flight Search
        ↓
Live Hotel Search
        ↓
AI Trip Builder   ← Sprint 110
        ↓
Decision Engine
        ↓
AI Response Composer
```

## Feature flag

`ai.trip_builder` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | Runner returns `{ enabled: false }` — legacy paths unchanged |
| ON | Validate → compose flight×hotel trips → cost/quality/confidence → rankings → Decision Engine pools + Response Composer packages |

## Ranking groups

- Best Overall
- Best Budget
- Best Luxury
- Best Family
- Best Business
- Best Value
- Best Short Stay
- Best Long Stay

## Notes

- Accepts offer pools from Live Flight Search / Live Hotel Search (does not call providers itself).
- Exposes `flightOffers` / `hotelStays` for Decision Engine consumption without changing Decision Engine contracts.
- Passes complete trip packages via `responseComposerPackages` and a ready `responseComposerInput` — Response Composer behavior is unchanged.
- Handles empty pools, provider failure signals, invalid dates/budget, and incompatible combinations.

## Verify

```bash
npm run trip-builder:verify
```
