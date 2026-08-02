# Sprint 89 Phase 2 — Planning & Reasoning

**Status:** Implemented (compile-only planning stack; flags OFF; BrainRouter runtime wire deferred)  
**Branch:** `cursor/sprint89-phase2-planning-71ec`  
**PR:** `#328`  
**Baseline:** Phase 1 Understanding on `main` (`d945c38` / `#327`)  
**Source of truth:** Brain Spec · AI Contracts · Behavior Spec · AI-first architecture revision · `docs/SPRINT89_PHASE2_IMPLEMENTATION_PLAN.md`

---

## Scope delivered (T2–T11)

| Task | Module | Location | Role |
| --- | --- | --- | --- |
| T2 | MissingInformationPlanner | `src/lib/brain/v1/planning/phase2/MissingInformationPlanner.ts` | blocking / deferrable / bookingOnly from Phase 1 `knownSlots` |
| T3 | AssumptionPolicy (+ MemoryManager `applyAssumptions`) | `AssumptionPolicy.ts` + `understanding/MemoryManager.ts` | reversible `source: "assumed"` proposals; no silent confirm |
| T4 | ConfidenceGates | `ConfidenceGates.ts` | pure `searchEligible` / `shouldClarify`; medium dates never authorize search |
| T5 | ClarificationBridge | `ClarificationBridge.ts` | ≤1 structured candidate; no ar/en copy; CM injection design-only |
| T6 | ToolDecisionBridge | `ToolDecisionBridge.ts` | five-way decision metadata only |
| T7 | PlanningHintsBuilder | `PlanningHintsBuilder.ts` | machine-readable planning hints |
| T8 | BrainRouterPlanningAdapter | `BrainRouterPlanningAdapter.ts` | normalize / freeze hints → planning result |
| T9 | BrainRouterDecisionContract | `BrainRouterDecisionContract.ts` | sealed decision contract |
| T10 | PlanReasonTurn | `PlanReasonTurn.ts` | sole Phase 2 planning authority + recovery |
| T11 | Goldens G06–G10 | `src/lib/__tests__/sprint89.phase2.goldens.test.ts` | ar+en behavioral lock |

**Facade:** `src/lib/brain/v1/planning/phase2/index.ts`

---

## Normative pipeline (intended product sequence)

```text
Conversation input
  → understandTurn (Phase 1)
  → memory / provenance handling
  → planReasonTurn (Phase 2)          ← shipped, pure / compile-only
  → BrainRouter (runtime wire)        ← NOT shipped in Phase 2; separate authorization
  → ConversationManager reply         ← untouched; sole final reply author
```

Phase 2 does **not** become a parallel brain, second turn owner, or response generator.

---

## Architectural guarantees (held)

1. `travelAgentService.planTurn` remains sole turn owner.  
2. Single Phase 2 planning authority = `planReasonTurn`.  
3. Phase 1 `UnderstandingTurnResult` / `knownSlots` / provenance / corrections / abort are SoT — **no re-extract**.  
4. ConversationManager remains the only final reply author (no Phase 2 user-facing copy).  
5. ToolDecision five-way (shipped): `ANSWER | CLARIFY | SEARCH_HANDOFF | ABORT | HANDOFF`.  
6. `SEARCH_HANDOFF` is eligibility metadata only; `executeSearch` / `invokeGateway` always `false`.  
7. Assumptions always `source: "assumed"`, reversible; never silently confirmed; never overwrite `user_stated`.  
8. Booking-only fields never block planning / search eligibility.  
9. Abort short-circuits clarify/search; no Phase 2 memory mutation (`memoryUnchanged: true`).  
10. Failure recovery preserves Phase 1 slots/provenance; sealed `ANSWER`/`ABORT`; no stack / CoT leakage.  
11. `planReasonTurn` order: `proposeAssumptions` → post-assumption `planMissingInformation` → gates → clarification → tool decision → hints → adapter → contract.  
12. Flags OFF; no Search / Gateway / LLM / Phase 3 execute; no Destination Knowledge content expansion DoD.

---

## ToolDecision (shipped)

| Decision | Meaning | Execute search/gateway? |
| --- | --- | --- |
| `ANSWER` | Advise without search | **No** |
| `CLARIFY` | Ask ≤1 structured candidate | **No** |
| `SEARCH_HANDOFF` | Search eligibility meta only | **No** |
| `ABORT` | Abort short-circuit | **No** |
| `HANDOFF` | Non-search planning handoff (e.g. compare / visa) | **No** |

Legacy plan names `REASON_MORE` / `SAFE_FALLBACK` are **not** emitted. Recovery uses sealed `ANSWER` / `ABORT`.

---

## Coverage summary

| Area | Tests |
| --- | --- |
| T2 Missing information | `sprint89.phase2.missingInformation.test.ts` |
| T3 Assumptions + assumed memory writes | `sprint89.phase2.assumptions.test.ts` |
| T4 Confidence gates | `sprint89.phase2.confidenceGates.test.ts` |
| T5 Clarification bridge | `sprint89.phase2.clarificationBridge.test.ts` |
| T6 ToolDecision | `sprint89.phase2.toolDecision.test.ts` |
| T7 Planning hints | `sprint89.phase2.planningHints.test.ts` |
| T8 Planning adapter | `sprint89.phase2.brainRouterPlanningAdapter.test.ts` |
| T9 Decision contract | `sprint89.phase2.brainRouterDecisionContract.test.ts` |
| T10 planReasonTurn | `sprint89.phase2.planReasonTurn.test.ts` |
| T11 Goldens G06–G10 (ar+en) | `sprint89.phase2.goldens.test.ts` |
| Phase 1 regressions (mandatory) | `sprint89.phase1.understanding.test.ts`, `sprint89.phase1.corrections.test.ts` |

**Verify:**

```bash
npm run sprint89-phase2:verify
npm run test:run
npm run typecheck
npm run lint
npm run build
```

### Goldens (T11)

| ID | Focus |
| --- | --- |
| G06 | Clarify-before-search (Morocco-only insufficient) — ar + en |
| G07 | ¬SEARCH_HANDOFF while blocking remains — ar + en |
| G08 | Assumption not promoted — ar + en |
| G09 | Correction then replan missing (e.g. Dubai→Morocco) — ar + en |
| G10 | Abort skips Phase 2 memory mutation — ar + en |

---

## Changed files (implementation)

- `src/lib/brain/v1/planning/phase2/**` (new Phase 2 facade)
- `src/lib/brain/v1/understanding/MemoryManager.ts` (`applyAssumptions` for assumed-source commits)
- `src/lib/__tests__/sprint89.phase2.*.test.ts` (T2–T11)
- `package.json` (`sprint89-phase2:verify`)
- `docs/SPRINT89_PHASE2_IMPLEMENTATION_PLAN.md`
- `docs/SPRINT89_PHASE2_NOTES.md` (this file)

---

## Definition of Done — Phase 2 (closeout)

| DoD item | Status |
| --- | --- |
| Single planning authority = `planReasonTurn`; no parallel Phase 2 brain | **Done** |
| Consumes Phase 1 Understanding / knownSlots / provenance; no re-extract | **Done** |
| MissingInformationPlanner: genuinely missing; booking never blocking | **Done** |
| Clarification ≤1; value-before-question meta; no re-ask known | **Done** (copy deferred to CM) |
| Corrections / abort / recovery preserve Phase 1 guarantees | **Done** |
| Assumptions `source: assumed` only; no silent confirm | **Done** |
| ToolDecision five-way; blocking ⇒ ¬SEARCH_HANDOFF | **Done** |
| SearchHandoff decision-only; no gateway/search/provider execute | **Done** |
| No Phase 3 execute / no DK expansion / no parallel fabric | **Done** |
| Flags OFF; freeze green | **Done** |
| Acceptance goldens G06–G10 ar+en + Phase 1 correction regressions | **Done** |
| `sprint89-phase2:verify` + full `test:run` green | **Done** |
| Phase 2 notes published | **Done** (this doc) |
| Sequential BrainRouter soft-wire: understand → memory → planReason → CM | **Deferred** — separate authorization; not part of T2–T12 |
| CM consumes `planningHints` at runtime (reply-only) | **Deferred** — design-only injection contract in T5; no CM code change |

---

## Explicit non-goals / deferred (do not start from Phase 2 closeout)

- BrainRouter runtime sequential wire (`planReasonTurn` into preview spine)  
- ConversationManager `planningHints` injection / reply formatting  
- Search Handoff **execute** (Sprint 90 / Phase 3+)  
- ProviderGateway / LLM calls  
- Feature-flag enablement  
- Destination Knowledge content expansion  
- Booking / payment / voice / UI redesign  
- Phase 3–5 delivery  

**Still deferred:** Search Handoff Option A execute, provider execute, booking/payment, voice providers, BrainRouter+CM product wire.

---

## Explicit non-goals (Phase 2)

Second conversation brain · Parallel product pipeline · Phase 2 reply generators · Search execute · Ranking · Itinerary delivery · Voice · Booking · Payment
