# Sprint 89 Phase 1 — Understanding Core

**Status:** Implemented (preview-gated; flags OFF)  
**Branch:** `cursor/sprint89-phase1-understanding-71ec`  
**Baseline:** Sprint 88 complete (`sprint88-complete`)  
**Source of truth:** Brain Spec · AI Contracts · Behavior Spec · AI-first architecture revision  

---

## Scope delivered

| Module | Location | Role |
| --- | --- | --- |
| IntentExtractor | `src/lib/brain/v1/understanding/IntentExtractor.ts` | Consultant intents + legacy BrainV1Intent map |
| EntityExtractor (provenanced) | `src/lib/brain/v1/understanding/EntityExtractor.ts` | Provenance/confidence facts over foundation extractor |
| ReferenceResolver | `src/lib/brain/v1/understanding/ReferenceResolver.ts` | Anaphora / relative refs; ambiguity without invention |
| ConversationState | `src/lib/brain/v1/understanding/ConversationState.ts` | Brain cognitive state ↔ PreviewConversationStage; `knownSlots` / `supersededFields` |
| MemoryManager | `src/lib/brain/v1/understanding/MemoryManager.ts` | Facade over Sprint 88 adapters; `preserveOnAbort`; correction provenance |
| understandTurn | `src/lib/brain/v1/understanding/understandTurn.ts` | Intent → Entity → Reference → State pipeline |
| BrainRouter+ | `src/lib/brain/v1/preview/BrainRouter.ts` | Runs understanding when preview ON; populates contract meta |

---

## Architectural guarantees

1. `travelAgentService.planTurn` remains sole turn owner.  
2. `ai.brain.v1` OFF (frozen); `ai.brain.v1.preview` OFF by default / prod hard-blocked.  
3. No `ai.tie.v1`.  
4. No Search Handoff execution — `searchHandoffHint` stays `early_return_locked`.  
5. `toolBatch: null` on Brain success path (unchanged).  
6. No provider gateway execution, booking, payment, voice, or UI redesign.  
7. Assumptions are **not** written as confirmed facts; assumption commits deferred to Phase 2.  
8. Default-OFF `planTurn` path unchanged (no `brainV1Preview` meta).

---

## Coverage summary

| Area | Tests |
| --- | --- |
| Unit — Intent / Entity / Reference / State / Memory | `sprint89.phase1.understanding.test.ts` |
| Contract — understanding pipeline + BrainRouter meta | same file |
| Hardening — corrections / abort / stale refs / provenance | `sprint89.phase1.corrections.test.ts` |
| Regression — Sprint 88 preview contracts | `sprint88.previewContracts.task2.test.ts` (updated expectations) |
| Regression — Sprint 86 preview router | `brainPreview.sprint86.test.ts` via verify script |

**Verify:**

```bash
npm run sprint89-phase1:verify
npm run test:run
npm run typecheck
npm run lint
```

### Correction hardening (pre-merge)

- Destination / dates / traveler corrections override priors (`kind: corrected`, ConversationState `supersededFields`)
- ReferenceResolver ignores stale `recentTexts` on correction; never re-applies conflicting refs
- Abort/cancel proposes no memory writes; `preserveOnAbort` keeps confirmed memories
- Provenance records `previousValue` + `corrected` after overrides

---

## Changed files (implementation)

- `src/lib/brain/v1/understanding/**` (new)
- `src/lib/brain/v1/preview/BrainRouter.ts`
- `src/lib/brain/v1/EntityExtractor.ts` (Turkey alias)
- `src/lib/brain/v1/IntentDetector.ts` (plan_trip Arabic cues)
- `src/lib/brain/v1/index.ts` / `preview/index.ts` exports
- `src/lib/agent/types.ts` (`brainV1Preview.understanding` meta)
- `src/lib/__tests__/sprint89.phase1.understanding.test.ts`
- `src/lib/__tests__/sprint89.phase1.corrections.test.ts`
- `src/lib/__tests__/sprint88.previewContracts.task2.test.ts`
- `package.json` (`sprint89-phase1:verify`)
- Spec baseline docs + `docs/SPRINT89_PHASE1_NOTES.md`

---

## Remaining work — Phase 2 (do not start here)

- Missing Information Planner / sufficiency model  
- ClarificationPolicy wiring for clarify-before-search enforcement in understanding path  
- ConversationPlanner / Value-first formalization beyond existing CM  
- TravelReasoner traces expansion  
- ToolDecisionEngine deny-by-default without live execute  
- AssumptionEngine commits (reversible assumptions)  
- Golden expansions for correction / reference ambiguity  

**Still deferred:** Search Handoff Option A (Sprint 90), provider execute, booking/payment, voice providers.

---

## Explicit non-goals (Phase 1)

Conversation Planner · Missing Information Planner · Travel Reasoner (new) · Search · Ranking · Itinerary · Voice · Booking · Payment
