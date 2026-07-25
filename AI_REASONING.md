# AI Reasoning — Consultant Reasoning Layer (Evolution Sprint 1)

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.consultant_reasoning` **default OFF**  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Production Authority · `planTurn` orchestration remain untouched.

This document describes the **Consultant Reasoning Layer**: offline, deterministic modules that think like an elite travel consultant — not a chatbot and not an itinerary generator.

---

## 1. Reasoning architecture

```
ConsultantReasoningInput (userText + optional known slots)
        │
        ▼
┌───────────────────────┐
│ TravelerIntentAnalyzer│  intent / purpose / urgency
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ TravelerProfileBuilder│  soft pace / budget stance / risk / interests
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ ConstraintAnalyzer    │  hard / soft / flexible dimensions
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ DestinationReasoner   │  directional fit (no live inventory)
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ BudgetReasoner        │  stance + value-over-cheapest
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ RiskReasoner          │  qualitative risk + mitigations
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ ValueReasoner         │  expected value ≠ cheapest
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ RecommendationReasoner│  Why / Why not / Alternative / Tradeoffs / Risk / Expected value
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ ExplanationGenerator  │  AR/EN consultant-facing narrative
└───────────┬───────────┘
            ▼
     ReasoningPipeline rollup (overall ReasoningSlice)
```

**Coexistence with Sprint 45:** `travelReasoningEngine` remains the production open-ended destination engine on the agent path (`ai.travel_reasoning`). The consultant layer is a sibling under `src/lib/agent/reasoning/` and must not replace or rewrite that engine.

**Production spine (unchanged):** `/chat` → `chatEngine` → `planTurn` / `runPlanTurn`. Consultant reasoning is **not** invoked from that spine in Sprint 1.

---

## 2. Reasoning flow

1. Caller builds `ConsultantReasoningInput` (`userText`, optional `known` slots, `locale`).
2. Prefer `tryRunConsultantReasoningPipeline` so the feature flag gates product use.
3. Pipeline runs modules in order (each may re-derive upstream slices for purity; no shared mutable state).
4. `RecommendationReasoner` chooses a `primaryAction`:
   - `clarify` · `recommend_direction` · `compare_options` · `proceed_planning` · `defer`
5. `ExplanationGenerator` emits locale-aware Why / Why not / Alternative / Tradeoffs / Risk / Expected value lines.
6. Pipeline returns `ConsultantReasoningPipelineResult` including an `overall` rollup slice.

**Rules**

- No network, booking, hotel, or flight calls.
- Never invent hard facts (destination, budget amount, dates) when absent — surface `missingInformation` and `assumptions`.
- Every module returns the shared `ReasoningSlice` fields.

---

## 3. Reasoning interfaces

### Shared slice (`ReasoningSlice`)

| Field | Meaning |
|-------|---------|
| `confidence` | 0–1 confidence in this analysis |
| `reasoning` | Consultant notes — why this conclusion |
| `tradeoffs` | Explicit trade-offs |
| `assumptions` | Assumptions under incomplete info |
| `missingInformation` | What would raise confidence |
| `recommendationScore` | 0–100 fit / recommendation score |

### Entry points

| Symbol | Role |
|--------|------|
| `runConsultantReasoningPipeline(input)` | Always runs (tests / forced use) |
| `tryRunConsultantReasoningPipeline(input, opts?)` | Returns `null` when flag OFF |
| `isConsultantReasoningEnabled(opts?)` | Feature gate |
| `ReasoningPipeline` / PascalCase module aliases | Mission-facing names |

### Module API (PascalCase aliases)

| Module | Function | Alias |
|--------|----------|-------|
| TravelerIntentAnalyzer | `analyzeTravelerIntent` | `TravelerIntentAnalyzer.analyze` |
| TravelerProfileBuilder | `buildTravelerProfile` | `TravelerProfileBuilder.build` |
| ConstraintAnalyzer | `analyzeConstraints` | `ConstraintAnalyzer.analyze` |
| DestinationReasoner | `reasonAboutDestination` | `DestinationReasoner.reason` |
| BudgetReasoner | `reasonAboutBudget` | `BudgetReasoner.reason` |
| RiskReasoner | `reasonAboutRisk` | `RiskReasoner.reason` |
| ValueReasoner | `reasonAboutValue` | `ValueReasoner.reason` |
| RecommendationReasoner | `reasonAboutRecommendation` | `RecommendationReasoner.reason` |
| ExplanationGenerator | `generateExplanation` | `ExplanationGenerator.generate` |
| ReasoningPipeline | `runConsultantReasoningPipeline` | `ReasoningPipeline.run` |

Contracts live in `src/lib/agent/reasoning/consultantTypes.ts`.

---

## 4. Future extension points

| Extension | Guidance |
|-----------|----------|
| Wire into Brain / planTurn | **Later sprint only** via additive stage + flag; never rewrite frozen cores |
| Feed Decision Engine | Pass recommendation package as advisory meta — Decision Engine stays owner of offer selection |
| Memory bridge | Read durable preferences into `known` without inventing slots |
| Live advisories | RiskReasoner may later consume Sprint 53 signals behind a provider port — keep this layer qualitative by default |
| LLM polish | ExplanationGenerator may optionally polish copy later; core scores stay deterministic |
| A/B vs Sprint 45 | Keep both engines; converge on shared destination-direction vocabulary before merging |

---

## 5. Feature flag

| ID | Default | Notes |
|----|---------|-------|
| `ai.consultant_reasoning` | **OFF** | Experimental; depends on `ai.concierge`; not attached to `planTurn` |

---

## 6. Tests

`src/lib/__tests__/consultantReasoning.sprint1.test.ts`

- Unit coverage per module (slice contract)
- Pipeline + determinism
- Arabic + English examples
- Regression: Sprint 45 still callable; no `planTurn` export; no invented destination locks
