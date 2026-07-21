# Sprint 75 — Budget Intelligence

**Type:** Additive enrichment layer  
**Depends on:** Sprint 71 Provider Runtime · Sprint 72/73 Search Engines · Sprint 74 conversation wiring · Booking Intelligence

## Goal

Let Rahhal understand travel budgets from natural conversation and rank flights/hotels/packages with a **Budget Score** — not price-only sorting.

## Architecture (additive)

```
User utterance
    ↓
extractRequirements (+ richer budget phrases)
    ↓
Flight / Hotel Search Engines (Sprint 72/73) via Provider Runtime
    ↓
Budget Intelligence (Sprint 75)  ← NEW
    ├── parse budget / currency / ranges / intent
    ├── allocate across flights · hotels · transport · activities
    ├── Budget Score rank (price fit · value · quality · savings · time)
    └── diagnostics
    ↓
Booking Intelligence (unchanged parallel enrichment)
    ↓
Conversation Brain (narrates facts)
```

No RahhalBrain redesign. No search engine replacement.

## Conversation understanding

Examples handled without forms:

- “My budget is SAR 8,000”
- “Keep everything under $2,000”
- “Luxury but under 15,000”
- “Cheapest possible”
- “Business class if within budget”
- “Best value” / “premium” / “economy”
- Ranges: “between 5000 and 8000”

## Allocation defaults

| Style | Flights | Hotels | Transport | Activities (future) |
| --- | --- | --- | --- | --- |
| Budget | 42% | 38% | 12% | 8% |
| Midrange | 40% | 40% | 12% | 8% |
| Luxury | 35% | 45% | 10% | 10% |

Search bridge uses allocation for `maxPrice` caps (additive to Sprint 74 filters).

## Budget Score factors

- Price Fit
- Value
- Trip Quality
- Savings
- Travel Time

## Diagnostics

`budgetDetected` · `currency` · `allocatedBudget` · `remainingBudget` · `budgetScore` · overflow/underflow/missing

## Module

`src/lib/agent/budgetIntelligence/`

Feature flag: `ai.budget_intelligence` (default **ON**, depends on `ai.autonomous_agent`)

Verify: `npm run budget:verify`

## Example conversation

> User: I want to travel from Riyadh to Tokyo next month. My budget is SAR 8,000.  
> Rahhal: (searches via engines) → Budget Intelligence allocates ~flights/hotels → ranks best budget-fit package → reply includes recommendations with remaining budget context.

## Known limitations

- Activities share is reserved (placeholder); not searched yet.
- Booking Intelligence still runs its own search in parallel.
- Live provider spend depends on flags/secrets (default mock).

## Next recommendations

1. Feed Budget Score into Booking Intelligence combination optimizer.
2. Persist budget intent across multi-turn memory slots.
3. Surface overflow alternatives explicitly in spoken copy.
