# Sprint 55 — Real Booking Intelligence

Production Booking Intelligence layer for Rahhal’s autonomous travel agent.

Conversation Brain remains the **only** author of traveler-facing language.
Autonomous Agent orchestrates; Booking Intelligence enriches structured results.

## Architecture

```
Tools / simulated providers
  → Provider Registry (route by domain)
  → Result Fusion (merge, dedupe, normalize, confidence)
  → Ranking Engine v2 (multi-factor, never price-only)
  → Cost Optimizer (split / package / mixed)
  → Booking Readiness + Confidence + Explanations
  → TravelFacts.recommendations (facts only)
  → Conversation Brain (displayText / spokenText)
```

## Domains

flights · hotels · activities · car_rental · airport_transfer · insurance · visa

Each provider exposes: `search`, `details`, `availability`, `price`, `book` (stub), `cancel` (stub).

## Feature flag

`ai.booking_intelligence` (beta, default ON; depends on `ai.autonomous_agent`)

Override in tests: `bookingIntelligenceEnabled: false`

## Modules

| File | Role |
|------|------|
| `providerRegistry.ts` | Unified routing — agent never imports adapters |
| `simulatedAdapters.ts` | Swappable sims until live APIs |
| `fusion.ts` | Merge / dedupe / normalize / confidence |
| `rankingV2.ts` | Multi-factor ranking |
| `travelerPreferences.ts` | Persistent booking taste |
| `costOptimizer.ts` | Combination value search |
| `bookingReadiness.ts` | BookingReady + one clarification |
| `confidence.ts` | Confidence + reasons + alternatives |
| `explanations.ts` | User-facing WHY (no internal scores) |
| `orchestrator.ts` | End-to-end run |
| `enrich.ts` | Post-tool plan enrichment |

## Non-goals

- No Conversation Brain changes
- No hardcoded chat replies
- No breaking `planTurn` / ChatProvider APIs
- Live provider adapters plug in later with zero orchestration changes
