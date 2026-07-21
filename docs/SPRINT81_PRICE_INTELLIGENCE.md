# Sprint 81 — AI Price Intelligence & Booking Timing

**Type:** Additive booking-timing reasoning layer (`src/core/priceIntelligence` + agent bridge)  
**Depends on:** Adaptive Learning (80) · Decision Engine (79)

## Goal

Predict whether the traveler should **book now**, **wait**, or **watch prices** — using available provider results and historical observations.

This is **not** a live pricing integration. RahhalBrain architecture is unchanged.

## Architecture (additive)

```
Conversation
    ↓
Strategy Planner
    ↓
Search
    ↓
Decision Engine
    ↓
Adaptive Learning (profile)
    ↓
Price Intelligence  ← Sprint 81
    ↓
Booking Recommendation
```

## Modules

| Path | Role |
| --- | --- |
| `PriceAnalyzer.ts` | Current vs average/cheapest/premium, calendar & demand signals |
| `PriceTrend.ts` | Trend direction + volatility |
| `ConfidenceCalculator.ts` | 0–100 timing confidence |
| `OpportunityDetector.ts` | Bargain / spike / likely up-down / uncertainty |
| `BookingTimingEngine.ts` | Picks exactly one timing action |
| `TimingRecommendation.ts` | Domain models + explanation formatter |
| `src/lib/agent/priceIntelligence/bridge.ts` | Agent enrich + offer-pool input builder |

## Timing actions (exactly one)

`BOOK_NOW` · `WAIT` · `WATCH_PRICE` · `PRICE_TOO_HIGH` · `LIMITED_AVAILABILITY` · `NO_CONFIDENT_RECOMMENDATION`

## Explanation

Every recommendation includes reason, confidence %, signals used, positive/negative indicators, and a traveler-facing explanation, e.g.:

> Book now because prices are below the observed average, availability is decreasing, and confidence is 91%.

## Feature flag

`ai.price_intelligence` (default **ON**, depends on `ai.adaptive_learning`)

Verify: `npm run price:verify`

## Observability

`price.analysis.started` · `price.analysis.finished` · `booking.recommendation` · `timing.confidence` · `opportunity.detected`

## Performance

- Pure synchronous reasoning over in-memory offer totals / observations
- Typical runtime well under 5ms per analysis
- No network I/O; no ML training

## Coverage

Unit tests in `src/lib/__tests__/priceIntelligence.sprint81.test.ts` (≥20 cases): cheap/expensive, weekend/holiday, confidence, wait/book/watch, demand, availability, seasonality, booking window, volatility, opportunities, edges, agent bridge.
