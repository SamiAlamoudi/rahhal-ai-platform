# Sprint 77 — Complete Trip Optimizer

**Type:** Additive enrichment layer  
**Depends on:** Conversation · Flight/Hotel Search Engines · Budget Intelligence · Traveler Personalization · Booking Intelligence

## Goal

Optimize the **complete journey** (flight + hotel packages) with a unified **Journey Score**, instead of ranking flights, hotels, and budget in isolation.

## Architecture (additive)

```
Conversation intent (comfort / convenience / family / business / …)
    ↓
Flight + Hotel Search Engines → offer sets
    ↓
Budget Intelligence (Sprint 75)
    ↓
Traveler Personalization (Sprint 76)
    ↓
Trip Optimizer (Sprint 77)  ← NEW
    ├── Journey Score (0–100)
    ├── dimension scores + optimization factors
    ├── recommendation labels
    └── diagnostics / tradeoffs
    ↓
Booking Intelligence → Conversation Brain
```

No RahhalBrain redesign. No search engine replacement.

## Journey Score dimensions

- Budget Score
- Comfort Score
- Convenience Score
- Business Score
- Family Score
- Luxury Score
- Travel Time Score

## Optimization factors

Flight · Hotel · Airport transfer · Layover quality · Arrival/departure time · Check-in/out compatibility · Total travel duration · Sleep quality · Jet lag · Budget remaining · Traveler preferences · Family friendliness · Business suitability · Luxury · Walking distance · Weather compatibility · Risk score

## Recommendation labels

Best Overall · Best Value · Fastest · Luxury · Business · Family

## Conversation adaptation

- “I need the most comfortable option.”
- “I care about convenience.”
- “I don't mind paying more.”
- “I need minimum walking.”
- “I have children.”
- “I have an early meeting.”

## Diagnostics

`journeyScore` · `optimizationFactors` · `rankingBreakdown` · `budgetEffect` · `personalizationEffect` · `tradeoffs`

## Module

`src/lib/agent/tripOptimizer/`

Feature flag: `ai.trip_optimizer` (default **ON**, depends on `ai.autonomous_agent`)

Verify: `npm run optimizer:verify`

## Example conversation

> User: Trip from Riyadh to Dubai next month, budget SAR 8,000. I have an early meeting and need minimum walking.  
> Rahhal: searches → Budget Intelligence allocates → Personalization applies prefs → Trip Optimizer ranks packages by Journey Score (business + convenience weights) → Best Overall / Business / Fastest labels → reply cites journey score and tradeoffs if any.

## Known limitations

- Combinations are capped (default 24) for deterministic client-side performance.
- Transfer / jet-lag / weather use heuristic signals from offer fields when present.
- Does not rewrite Budget Score or Personalization internals — consumes their outputs.

## Next recommendations

1. Feed Journey Score into Booking Intelligence combination optimizer.
2. Persist chosen itinerary rationale on trip records.
3. Expand weather/risk adapters from live intelligence feeds.
