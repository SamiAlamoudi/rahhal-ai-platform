# AI Integration Stage 1 — Consultant Pipeline

**Status:** Additive orchestration · **Not** wired into `planTurn` · Flag `ai.consultant_pipeline` **default OFF**  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Reasoning · Reflection · Planning Graph · Traveler / Destination / Recommendation / Travel Strategy internals · planTurn · Production Authority remain untouched.

This stage does **not** add new intelligence. It orchestrates existing layers into one consultant-grade pipeline with enrich-only context exchange.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Consultant Pipeline (Stage 1)               │
│                 flag: ai.consultant_pipeline                │
│                 default OFF · lazy · CPU-only               │
└────────────────────────────┬────────────────────────────────┘
                             │
     enrich-only StageIOContext (never overwrite stage bags)
                             │
     ┌───────────────────────▼───────────────────────┐
     │ conversation → decision → reasoning →         │
     │ reflection → planning_graph → traveler →      │
     │ destination → recommendation → strategy →     │
     │ unified_response                              │
     └───────────────────────────────────────────────┘
```

### Package layout

| File | Role |
|------|------|
| `pipelineTypes.ts` | Shared contracts (context, stages, unified response) |
| `integrationRegistry.ts` | Maps stages → existing module entrypoints |
| `consultantStages.ts` | Stage order + feature gate helper |
| `consultantContext.ts` | Enrich-only context merge |
| `consultantState.ts` | Run state machine |
| `consultantExecution.ts` | Lazy stage adapters (public APIs only) |
| `consultantOutputs.ts` | Unified consultant response composer |
| `consultantPipeline.ts` | `run` / `tryRun` entrypoints |

Location: `src/lib/agent/orchestrator/` (alongside Sprint 113 orchestrator; no production path changes).

---

## 2. Pipeline flow

```
Input (userText + known slots)
        │
        ▼
 Conversation (local Conversation Brain — CPU)
        │
        ▼
 Decision (applyIntelligentDecisions only if plan+tools; else readiness)
        │  (+ optional Planning Draft enrichment via public API)
        ▼
 Reasoning (runConsultantReasoningPipeline)
        │
        ▼
 Reflection (reflectTurn)
        │
        ▼
 Planning Graph (createPlanningGraph + addRoot [+ optional branch])
        │
        ▼
 Traveler Intelligence (observeTraveler)
        │
        ▼
 Destination Intelligence (runDestinationIntelligence)
        │
        ▼
 Recommendation Intelligence (runRecommendationEngine)
        │
        ▼
 Travel Strategy (runTravelStrategyEngine)
        │
        ▼
 Unified Consultant Response
```

Each stage receives / emits:

- Input / output context  
- Confidence  
- Evidence  
- Missing information  
- Traveler snapshot  
- Planning snapshot  

**Rule:** stage outputs are stored under `stageOutputs[stageId]` once. Re-application never overwrites an existing bag — only enriches lists and empty snapshot fields.

**Stop rule:** if a stage returns `clarification` or confidence &lt; `minConfidence` (default `0.35`), the pipeline stops and asks questions instead of guessing.

---

## 3. Unified response

| Field | Source (composed, not invented) |
|-------|----------------------------------|
| Traveler Understanding | Traveler snapshot / reasoning profile / conversation |
| Destination Understanding | Destination snapshot / planning destinations |
| Recommended Strategy | Travel strategy primary + recommendation why |
| Alternative | Strategy alternatives + recommendation alternatives |
| Trade-offs / Risks | Strategy + recommendation + reasoning rollups |
| Budget / Time Impact | Recommendation impacts + strategy levers |
| Confidence | Rolling min across stages |
| Questions | Clarification queues / missing slots |

---

## 4. Feature flag

| ID | Default | Wired to planTurn |
|----|---------|-------------------|
| `ai.consultant_pipeline` | **OFF** | **No** |

Child evolution flags remain independently OFF. The pipeline calls `run*` public APIs (not `tryRun`) only when the pipeline itself is enabled/forced — demonstrating sequential integration without enabling production routes.

---

## 5. Performance

| Mode | Cost |
|------|------|
| Flag OFF / `tryRun` | Immediate `null` — zero stage work |
| Flag ON / forced | In-memory heuristics only; dynamic `import()` per stage |
| Network / LLM | None |
| Production chat | Unchanged (pipeline not imported by planTurn) |

---

## 6. Future activation plan

1. Keep flag OFF in production until Stage 2 wiring review.  
2. Optionally map Brain meta → `ConsultantPipelineInput.known` (read-only).  
3. Gate a non-production preview surface behind the flag.  
4. Never enable by default until confidence / clarification UX is validated.  
5. Do not attach to `planTurn` until an explicit wiring sprint.

---

## 7. Explicit non-goals (honored)

- No algorithm / scoring rewrites  
- No frozen core edits  
- No production routing  
- No network / LLM in the orchestrator  
- No merge to `main` (draft PR only)
