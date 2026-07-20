# Sprint 45 — Autonomous Travel Reasoning Engine

Make Rahhal reason like a travel consultant on **open-ended** requests — without forms, wizards, or “where do you want to go?” when the traveler already gave climate, budget, and timing.

## Example

> “I want somewhere cold next month with a budget of 12000 SAR.”

The agent should:

1. Detect open-ended destination discovery (`discover` intent + `destinationFlexible`)
2. Infer climate, month, and budget feasibility
3. Rank destinations with explainable scores (climate fit, budget, visa ease, flight distance, interests)
4. Propose primary + alternatives with pros/cons
5. Ask only for truly missing hard slots (travelers / duration) — never re-ask weather or destination

## Architecture

```
ChatPage → chatEngine → travelAgentService.planTurn
  ├─ extractRequirements (+ open-ended detector)
  ├─ preferenceBridge (seed + learn PreferenceEngine)
  ├─ travelReasoningEngine (catalog climate/budget/visa priors)
  ├─ formatReasoningReply (consultant AR/EN)
  └─ concierge (destination skipped while flexible)
```

| Module | Path |
|--------|------|
| Types | `src/lib/agent/reasoning/types.ts` |
| Catalog | `src/lib/agent/reasoning/destinationCatalog.ts` |
| Open-ended detector | `src/lib/agent/reasoning/openEndedDetector.ts` |
| Engine | `src/lib/agent/reasoning/travelReasoningEngine.ts` |
| Preference bridge | `src/lib/agent/reasoning/preferenceBridge.ts` |
| Reply formatter | `src/lib/agent/reasoning/formatReasoningReply.ts` |

## Feature flag (default **ON**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `travel_reasoning` | `ai.travel_reasoning` | `ai.concierge`, `ai.recommendation_engine` |

Additive on the production `/chat` agent path. Does **not** enable Sprint 19–44 brain stacks.

## Capabilities

1. **Open-ended discovery** — `somewhere` / `مكان بارد` / “where should I go”
2. **Climate × month scoring** — seasonal priors per destination
3. **Budget feasibility** — estimated trip cost vs stated budget (SAR-normalized)
4. **Visa / distance priors** — soft ranking signals for Saudi travelers
5. **Explainable recommendations** — `whySelected`, pros/cons, confidence
6. **Preference memory** — seed empty slots from `PreferenceEngine`; learn back (never overwrite explicit statements)
7. **Selection recovery** — “first one” / named pick locks destination and continues planning
8. **Arabic-first + English** consultant copy

## Non-goals

- Live weather / Amadeus / Booking APIs (still mock/default provider posture)
- Enabling experimental `brain.*` stacks
- UI redesign or form removal on legacy `/search`
- LLM vendor calls (deterministic reasoning only)

## Tests

`src/lib/__tests__/travelReasoning.sprint45.test.ts`
