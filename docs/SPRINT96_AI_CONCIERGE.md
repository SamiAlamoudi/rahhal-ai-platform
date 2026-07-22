# Sprint 96 — AI Concierge Experience

**Type:** Additive presentation / explanation layer (`src/core/conciergeExperience` + agent bridge)  
**Depends on:** Alpha Experience · Unified Trip facts (optional) · existing offer / decision outputs  
**Feature flag:** `ai.concierge_experience` (default **ON**) — distinct from legacy `ai.concierge`

## Goal

Make Rahhal feel like a **premium AI travel advisor**: visible reasoning, human explanations, alternatives, confidence, summaries, comparison cards, and proactive suggestions — without redesigning engines or breaking Sprints 91–95.

## Architecture

```
Trip / offer / decision facts (existing engines)
        ↓
ConciergeComposer
        ├─ Recommendation Timeline (Searching → Final)
        ├─ Explanation Engine (why destination/flights/hotel/package/timing)
        ├─ Alternative Scenarios (Price / Comfort / Fastest / Value / Luxury / Family)
        ├─ Confidence Indicator (High / Medium / Low + uncertainty)
        ├─ Conversation Summary
        ├─ Decision Comparison Cards
        └─ Concierge Suggestions (insurance, transfer, visa, weather, packing, transport)
        ↓
Agent bridge (flag-gated) → meta + recommendationFacts
```

**Does not modify:** Constitution, Conversation Brain, Decision Engine, Learning, Price Intelligence, Packages, Refinement, Alpha Experience, Unified Trip, Amadeus Sandbox, Booking Orchestrator, Provider Readiness.

## Flow

1. Agent supplies trip facts (+ optional flight/hotel/package/decision payloads).  
2. Timeline stages run: Searching → Comparing → Ranking → Optimizing → Final recommendation.  
3. Explanation engine authors natural-language “why” for each recommendation facet.  
4. Six alternative scenarios are always available (filled from decision/package labels when present).  
5. Confidence score maps to High / Medium / Low; uncertainty text appears when not High.  
6. Conversation summary + comparison cards + proactive suggestions complete the concierge pack.

## Added modules

| Module | Path | Role |
|--------|------|------|
| Types | `src/core/conciergeExperience/types.ts` | Contracts + version |
| RecommendationTimeline | `…/RecommendationTimeline.ts` | Reasoning stages |
| ExplanationEngine | `…/ExplanationEngine.ts` | NL explanations |
| AlternativeScenarios | `…/AlternativeScenarios.ts` | Six option kinds |
| ConfidenceIndicator | `…/ConfidenceIndicator.ts` | High/Med/Low |
| ConversationSummary | `…/ConversationSummary.ts` | Iteration summary |
| ComparisonCards | `…/ComparisonCards.ts` | Structured compare |
| ConciergeSuggestions | `…/ConciergeSuggestions.ts` | Proactive tips |
| ConciergeComposer | `…/ConciergeComposer.ts` | End-to-end assemble |
| Agent bridge | `src/lib/agent/conciergeExperience` | Flag + `runConciergeExperience` |

## Tests

File: `src/lib/__tests__/conciergeExperience.sprint96.test.ts`

Coverage areas:

- Feature flag registration / default ON / disable path  
- Timeline stage order and completion  
- Explanation facets (destination, flights, hotel, package, timing)  
- All six alternative scenario kinds  
- Confidence High vs Low + uncertainty  
- Conversation summary shape  
- Comparison card fields + recommended marker  
- Suggestion kinds  
- Full composer + agent bridge  

Verify:

```bash
npm run concierge-experience:verify
```

## Compatibility verification

| Check | Expectation |
|-------|-------------|
| Public engine APIs | Unchanged |
| Sprint 91 Alpha Experience | Untouched; coexists via separate flag |
| Sprint 93 Unified Trip | Untouched; optional facts consumer |
| Sprint 94 Booking Orchestrator | Untouched |
| Legacy `ai.concierge` | Preserved; not reused |
| Circular imports | None (`npm run arch:circular`) |
| Quality gates | `lint` · `typecheck` · `build` · `test` |

## Feature flag

`ai.concierge_experience` — default **ON**, depends on `ai.alpha_experience` + `ai.unified_trip` (registry metadata only; composers still run when facts are provided).
