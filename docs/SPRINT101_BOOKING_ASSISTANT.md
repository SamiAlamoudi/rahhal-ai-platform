# Sprint 101 — Smart Booking Assistant

**Type:** Additive presentation / orchestration (`src/core/bookingAssistant` + agent bridge)  
**Depends on:** Sprint 99 Alpha Experience Assembly · existing package / flight / hotel / price / booking-intelligence snapshots  
**Feature flag:** `ai.booking_assistant` (default **ON**) — OFF preserves legacy responses exactly

## Goal

Guide the traveler from planning to **booking readiness** by composing existing engine + Alpha outputs into a Booking Ready Experience — without new travel intelligence.

## Architecture

```
Existing Engines
        ↓
Alpha Experience (Sprint 99)
        ↓
BookingAssistantComposer (Sprint 101)
        ├─ BookingReadiness
        ├─ BookingChecklist
        ├─ MissingRequirements
        ├─ BookingTimeline
        ├─ BookingWarnings (evidence-only)
        ├─ BookingActions
        ├─ Booking Confidence (reused — no new algorithm)
        └─ BookingSummary
        ↓
Booking Ready Experience (BookingAssistantDTO)
        ↓
meta.bookingAssistant → Traveler Response / Future UI
```

**Does not modify:** RahhalBrain, SearchPlanner, DecisionEngine, AdaptiveLearning, PriceIntelligence, Dynamic Packages, Booking engines, Providers, Flight/Hotel search, existing APIs.

## Sections (omit when data missing)

| Section | Behavior |
|---------|----------|
| Booking Readiness | Ready to Book / Need Destination / Travelers / Passport / Payment / Dates / Selection |
| Checklist | Flight / Hotel / Package / Dates / Travelers / Budget / Preferences |
| Missing Requirements | Derived from missingFields + checklist gaps |
| Timeline | Planning → Searching → Comparing → Optimizing → Booking Ready → Payment → Confirmation |
| Warnings | Only when supporting signals exist (seats, rooms, price opportunities, visa flag, passport status) |
| Suggested Next Action | Continue searching / Compare / Choose hotel / Reserve / Proceed to booking / … |
| Confidence | Reuses Alpha / engine confidence scores — **no new algorithm** |
| Summary | Flight · Hotel · Package · Total · Savings · Confidence · Next action |

## Feature flag

`ai.booking_assistant` — default **ON**, depends on `ai.alpha_experience` (registry metadata).

- **ON:** `planTurn` attaches `bookingAssistant` after Alpha assembly.
- **OFF:** assembly returns `null`; current responses unchanged.

## Integration order

```
Engines → Concierge → Alpha Experience → Booking Assistant → Traveler Response
```

Execution order of engines is unchanged; Booking Assistant only reads snapshots.

## Tests

File: `src/lib/__tests__/bookingAssistant.sprint101.test.ts`

```bash
npm run booking-assistant:verify
```

## Compatibility

| Check | Expectation |
|-------|-------------|
| Public engine APIs | Unchanged |
| Providers / booking / search / decision / packages | Unchanged |
| Circular imports | None |
| Quality gates | lint · typecheck · build · test |
| Flag OFF | Legacy response exact |
