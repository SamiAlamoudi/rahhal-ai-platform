# AI Integration Stage 2 — Consultant Pipeline Activation

**Status:** Safe planTurn integration · Flag `ai.consultant_pipeline` **default OFF**  
**Freeze:** Production planning algorithms, Decision Engine internals, Conversation Brain authorship, itinerary builders remain untouched.

Stage 2 connects the existing Consultant Pipeline to `planTurn` as a **read-only enrichment** after production planning completes.

---

## 1. Mission

| Concern | Behavior |
|---------|----------|
| Flag OFF | Current production path only — identical behavior |
| Flag ON | Production planning runs normally, then pipeline enriches `meta` |
| Mutation | **Forbidden** — no tripPlan / destination / pricing / itinerary / reply changes |

---

## 2. Routing

```
planTurn(input)
    │
    ▼
 production planning (unchanged)
    │
    ▼
 result { reply, memory, tripPlan, meta, toolBatch }
    │
    ▼
 sync gate: ai.consultant_pipeline ?
    │
    ├─ OFF / forced false ──► return result (no import, no latency)
    │
    └─ ON ── lazy import consultantActivation
              │
              ▼
         runConsultantPipeline (read-only inputs)
              │
              ▼
         meta.consultantPipeline = activation snapshot
              │
              ▼
         return { ...result, meta }   // same tripPlan / reply / memory refs
```

Implementation: thin wrapper at the end of `createTravelAgentService` around `service.planTurn`.

---

## 3. Activation snapshot (`meta.consultantPipeline`)

| Field | Meaning |
|-------|---------|
| travelerUnderstanding | Pipeline traveler understanding |
| destinationUnderstanding | Destination understanding |
| travelStrategy | Recommended strategy lines |
| recommendationSummary | Compact recommendation / impact lines |
| alternative | Alternatives |
| tradeoffs / risks | Trade-offs and risks |
| confidence | Pipeline confidence |
| missingInformation | Missing slots / evidence gaps |
| clarificationQuestions | Questions when confidence insufficient |
| telemetry | Execution time, stage timings, clarification count, success |

---

## 4. Safety rules

- Pipeline receives plan/requirements/tool results as **inputs only**
- Never writes back into `memory.tripPlan`, `meta.tripPlan`, or `reply`
- Pipeline errors **fail open** — production turn returned unchanged
- No PII in telemetry (no user text, emails, or conversation content)

---

## 5. Performance

| Mode | Cost |
|------|------|
| Flag OFF | Sync registry check only |
| Flag ON | Dynamic import + CPU pipeline after planning |
| Network / LLM | None |

---

## 6. Files

| Path | Role |
|------|------|
| `consultantActivation.ts` | Read-only enrich wrapper |
| `consultantTelemetry.ts` | Lightweight metrics |
| `travelAgentService.ts` | Optional `planTurn` wrapper (routing only) |
| `types.ts` | `AgentProviderMeta.consultantPipeline` |
| `consultantPipeline.stage2.activation.test.ts` | Activation tests |

---

## 7. Explicit non-goals

- No intelligence / scoring / algorithm changes  
- No Conversation Brain reply replacement  
- No default-ON flag  
- No merge to `main`
