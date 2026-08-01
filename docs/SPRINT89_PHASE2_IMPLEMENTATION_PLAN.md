# Sprint 89 Phase 2 — Planning & Reasoning Implementation Plan

**Document type:** Implementation plan (synced to shipped T2–T10 compile stack)  
**Status:** T2–T10 shipped on `cursor/sprint89-phase2-planning-71ec` (PR #328); T11 not started  
**Branch:** `cursor/sprint89-phase2-planning-71ec`  
**Baseline:** `main` @ Phase 1 merge (`d945c38` / `#327`)  
**Review disposition:** Terminology synced to shipped ToolDecision (`SEARCH_HANDOFF`/`ABORT`) and task map (T6 ToolDecisionBridge … T10 PlanReasonTurn). BrainRouter runtime wire is **not** part of T2–T10.

**Governing docs:**  
- `docs/BRAIN_SPECIFICATION_v1.md`  
- `docs/AI_CONTRACTS_v1.md`  
- `docs/AI_BEHAVIOR_SPECIFICATION_v1.md`  
- `docs/ARCHITECTURE_SPRINT89_AI_FIRST_REVISION.md`  
- `docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md`  
- `docs/SPRINT89_PHASE1_NOTES.md`  

**Non-goals:** runtime code (until T1+ approved), flag enablement, Search Handoff **execute**, provider/gateway/search execution, booking/payment, Phase 3–5 delivery, Destination Knowledge content expansion as Phase 2 DoD.

---

## 0. Executive summary

Phase 2 adds the **planning & reasoning orchestrator** **inside BrainRouter**, on top of Phase 1 Understanding.

```text
Understanding (Phase 1) → Planning / Reasoning (Phase 2) → CM reply → (Search execute = Sprint 90 / Phase 3+)
```

**Phase 2 is NOT a second conversation brain.**  
It emits **planning decisions only**.  
**ConversationManager (CM) is the only response author** and **never makes planning decisions** when Phase 2 hints are present.

Phase 2 decides: what is genuinely missing, whether to ask (≤1), whether to give value first, whether tools/search are *eligible* (never executed here), and structured reasoner/explainability outputs — without live search, booking, or changing default-OFF production behavior.

**Reuse, do not rebuild:** Phase 1 `understandTurn` / `knownSlots` / provenance / corrections / abort; CM as reply surface; Phase 1 understanding + Phase 2 pure modules (`MissingInformationPlanner`, `AssumptionPolicy`, `ConfidenceGates`, `ClarificationBridge`, `ToolDecisionBridge`, `PlanningHintsBuilder`, `BrainRouterPlanningAdapter`, `BrainRouterDecisionContract`) behind single authority `PlanReasonTurn`. Phase 2 **formalizes contracts**, **wires understand → planReason → CM**, and **hard-enforces clarify-before-search**.

### 0.1 Normative invariants (must hold in every task)

1. **Sequential BrainRouter pipeline only** (see §1.1).  
2. **Single planning authority** on the preview path = `planReasonTurn` (Phase 2).  
3. **CM never makes planning decisions** when `planningHints` are provided; it renders copy from those hints.  
4. Phase 2 **consumes** `UnderstandingTurnResult`, `knownSlots`, provenance, correction/abort state — **MUST NOT re-extract** intent or slots.  
5. **`knownSlots` are the single source of truth** for trip facts on the preview planning path.  
6. **Corrections always override** previous values (Phase 1 guarantees preserved).  
7. Assumptions always `source: "assumed"` (never silent confirm / `user_provided`).  
8. **Search is NEVER executed in Phase 2** (no provider, no gateway, no toolBatch search).  
9. Phase 2 may only emit **planning decisions** (+ meta).  
10. **ToolDecision** exactly five outcomes: `ANSWER` | `CLARIFY` | `SEARCH_HANDOFF` | `ABORT` | `HANDOFF`.  
11. Clarification maximum = **one** question; **value-before-question** is mandatory when value is possible.  
12. No duplicate planning pipeline; no duplicate CM; no Phase 3 scope.

---

## 1. Architecture

### 1.1 Position in the stack (sequential — normative)

```text
Traveler (text | voice transcript → same text turn)
        │
        ▼
planTurn                    ← SOLE TURN OWNER (frozen)
        │
        ├─ preview OFF ──► Current Planner (unchanged)
        │
        └─ preview ON (non-prod / test bypass only)
                │
                ▼
         BrainRouter+          ← single product preview spine
                │
                ▼
         understandTurn        ← Phase 1 (Understanding)
                │
                ▼
         MemoryManager         ← unless abort (preserveOnAbort)
                │
                ▼
         planReasonTurn        ← Phase 2 (Planning authority ONLY)
                │                 emits planningHints / ToolDecision / handoff
                ▼
         ConversationManager   ← ONLY response author
                │                 consumes planningHints; does NOT re-decide plan
                ▼
         TravelAgentTurnResult
                toolBatch: null
                searchHandoffHint: blocked_* | early_return_locked
                understanding meta + planning meta
```

**Forbidden shapes:** sibling Phase1 ‖ Phase2 forks; parallel `pipeline.ts` product path; Phase 2 reply generators; CM recomputing missing/clarify/tool stance when hints present.

### 1.2 Principles

| Principle | Phase 2 implication |
| --- | --- |
| AI-first / conversation-first | Planners produce consultant **moves**, not forms |
| Think before acting | No SEARCH_HANDOFF eligibility before sufficiency |
| Clarify-before-search | Blocking gaps ⇒ ToolDecision ≠ `SEARCH_HANDOFF`; handoff blocked |
| Never expose workflow | State/planner names never in user text |
| Extend, don’t fork | No second turn owner; no `ai.tie.v1` |
| Flags OFF | `ai.brain.v1` frozen OFF; preview OFF default / prod hard-block |
| Book future-only | No booking/payment paths |
| Phase 2 = planner only | Decisions + meta; CM owns words |

### 1.3 Layering & decision authority

| Layer | Owner | Phase | Authority |
| --- | --- | --- | --- |
| Understanding | `understanding/*` | 1 (done) | Facts: knownSlots, provenance, corrections, abort |
| Planning & reasoning | `planning/phase2/*` facade | 2 | **Planning decisions** on preview path |
| Reply copy | `conversation/ConversationManager` | existing | **Surface text only** from Phase 2 hints |
| Search contracts / execute | DomainIntelligence + gateway | 3 / Sprint 90 | **Out of Phase 2** |
| Delivery polish | Itinerary / ranking | 4 | Out |
| Voice/booking/payment seams | prep | 5 | Out |

**Decision authority on preview path**

| Concern | Authority |
| --- | --- |
| Intent / entities / references / knownSlots | Phase 1 (`UnderstandingTurnResult`) |
| Missing / blocking / deferrable / bookingOnly | Phase 2 MissingInformationPlanner |
| Assumptions propose/apply (`source: assumed`) | Phase 2 AssumptionPolicy |
| canSearch / shouldClarify / searchEligible | Phase 2 ConfidenceEngine |
| Whether to ask + merged question | Phase 2 Clarification (≤1) |
| Value-before-question (meta) | Phase 2 `PlanReasonTurn` `ValueBeforeQuestionMeta` (CM formats later) |
| moveType | Phase 2 Conversation move planner |
| ToolDecision (five-way) | Phase 2 |
| SearchHandoffHint | Phase 2 (decision-only) |
| User-facing Arabic/English strings | **CM only** |

---

## 2. File structure (proposed)

```text
src/lib/brain/v1/
  understanding/                 # Phase 1 — DO NOT rebuild; consume only
  planning/
    phase2/                      # NEW — facade / orchestration (NOT a second CM)
      types.ts                   # PlanReason I/O, ToolDecision five-way, versions
      MissingInformationPlanner.ts
      AssumptionPolicy.ts
      ConfidenceGates.ts         # pure canSearch / shouldClarify / searchEligible
      ClarificationBridge.ts     # ≤1 candidate; no copy (shipped T5)
      ToolDecisionBridge.ts      # five-way decisions; never executes (shipped T6)
      PlanningHintsBuilder.ts    # machine-readable hints (shipped T7)
      BrainRouterPlanningAdapter.ts  # normalize only (shipped T8)
      BrainRouterDecisionContract.ts # sealed decision contract (shipped T9)
      PlanReasonTurn.ts          # pure orchestration + recovery (shipped T10)
      index.ts                   # Phase 2 public exports
      # ValueFirstBridge / ConversationMoveBridge / TravelReasonerBridge /
      # SearchHandoffDecision / ExplainabilityBridge / FailureRecovery.ts —
      # not separate shipped modules; value-before-question + recovery live in PlanReasonTurn;
      # search handoff meta lives on ToolDecisionBridge / PlanningHints
    # existing planning/* — do not stand up as parallel product spine
  conversation/                  # CM = reply author; accept planningHints
  TravelReasoner.ts              # additive structured fields only
  preview/
    BrainRouter.ts               # sequential: understand → memory → planReason → CM
  contracts/                     # read existing types only in Phase 2; no Phase 3 execute

src/lib/__tests__/
  sprint89.phase2.planning.test.ts
  sprint89.phase2.clarifyBeforeSearch.test.ts
  sprint89.phase2.assumptions.test.ts
  sprint89.phase2.toolDecision.test.ts
  sprint89.phase2.authority.test.ts    # CM does not re-decide when hints present

# Verify script MUST also run Phase 1 regressions:
#   sprint89.phase1.understanding.test.ts
#   sprint89.phase1.corrections.test.ts

docs/
  SPRINT89_PHASE2_IMPLEMENTATION_PLAN.md
  SPRINT89_PHASE2_NOTES.md             # closeout only
```

**Rules**

- Bridges **delegate** to `conversation/*` engines first.  
- Foundation `ClarificationPlanner` / `ConversationPlanner` / `ToolDecisionEngine` / `pipeline.ts` are **not** a second product path; use only if needed as pure helpers behind Phase 2 — never beside BrainRouter.  
- **Do not** add `planning/phase2` reply generators.  
- Keep `sprint89.phase1.*` tests green in `sprint89-phase2:verify`.

---

## 3. Components

| Component | Responsibility | Foundation | Preview-path authority |
| --- | --- | --- | --- |
| Phase 1 understandTurn | Intent/entity/ref/state/memory proposals | `understanding/*` | Fact SoT input |
| UnderstandingMemoryManager | Apply facts; abort preserve; assumed writes | Phase 1 + Sprint 88 adapters | Memory writes |
| **MissingInformationPlanner** | Genuinely missing / blocking / deferrable / bookingOnly | ToolMissingFields patterns | Phase 2 |
| **AssumptionPolicy** | Propose/apply reversible assumptions `source: assumed` | AssumptionEngine | Phase 2 |
| **ConfidenceGates** | canSearch, shouldClarify, searchEligible | ConfidenceEngine | Phase 2 |
| **ClarificationBridge** | ≤1 merged question; no re-ask known | ClarificationPolicy, QuestionGenerator | Phase 2 |
| **ValueBeforeQuestionMeta** (in PlanReasonTurn) | Strategy meta only; CM formats later | — | Phase 2 |
| **ConversationMoveBridge** | moveType only | — | Phase 2 |
| **TravelReasonerBridge** | Structured decisions + safe explainability inputs | TravelReasoner, DK read-only | Phase 2 |
| **ToolDecisionBridge** | Five-way ToolDecision (`SEARCH_HANDOFF`/`ABORT`/…) | pure; no execute | Phase 2 |
| **SearchHandoffMeta** (on ToolDecisionBridge) | Decision-only hint | ToolDecisionResult | Phase 2 |
| **ExplainabilityBridge** | User-safe whyTop/alternatives; no CoT | ConversationExplainability | Phase 2 |
| **FailureRecovery** (inlined in PlanReasonTurn) | Preserve memory; sealed `ANSWER`/`ABORT` | PlanReasonTurn recovery | Phase 2 |
| **planReasonTurn** | Orchestrate Phase 2; emit `planningHints` | new | Phase 2 owner |
| **ConversationManager** | Render Arabic/English reply from hints | existing | **Reply only** |
| **BrainRouter+** | Sequential wire | existing | Spine |

**Phase 1 reuse (mandatory inputs — not reimplemented)**

- `UnderstandingTurnResult` (intent, entities/facts, references, state, memoryProposals, provenance, summary)  
- `ConversationStateSnapshot.knownSlots` / `supersededFields`  
- `UnderstandingMemoryManager` + `preserveOnAbort`  
- Correction kinds (`corrected`) and abort short-circuit  

---

## 4. Interfaces

### 4.1 Envelope policy

- **Required** on `planReasonTurn` request/response boundary: shared envelope fields from AI Contracts (`contractVersion`, ids, locale, timestamp, source, confidence, assumptions, provenance, warnings, errors, latencyMs, traceId, privacyClassification, payload).  
- **Internal** steps may use slim types that still carry confidence + provenance where facts move.  
- Full per-step envelopes are **not** DoD for T1–T4.

### 4.2 Phase 2 pipeline I/O

```text
PlanReasonTurnInput {
  understanding: UnderstandingTurnResult     // Phase 1 — required
  memory: AgentMemory
  conversationState: ConversationStateSnapshot  // knownSlots SoT
  locale: 'ar' | 'en'
  abort: boolean                             // from Phase 1 intent.primaryIntent === 'abort'
  priorClarificationAttempts: Array<{ field: string; count: number }>
  goalHint?: 'advise' | 'search' | 'compare' | 'explore'
}

PlanReasonTurnResult {
  contractVersion: 'sprint89-phase2-planning-1'
  sealed: true
  missing: MissingInformationResult
  assumptions: AssumptionPolicyResult
  confidence: ConfidenceDecision             // searchEligible, shouldClarify
  clarification: ClarificationBridgeResult   // ≤1 question; no copy
  valueBeforeQuestion: ValueBeforeQuestionMeta  // strategy only; CM formats later
  toolDecision: ToolDecisionResult           // five-way ONLY (ToolDecisionBridge)
  planningHints: PlanningHints               // PlanningHintsBuilder
  planningResult: BrainRouterPlanningResult  // BrainRouterPlanningAdapter
  decisionContract: BrainRouterDecisionContract  // sealed; no runtime invoke
  recovery: { used, failureCode, reason } | null  // sealed ANSWER/ABORT path
  capabilities: { executeSearch: false, invokeGateway: false, … }
  summary: { toolDecision, searchEligible, shouldAsk, abort, … }
}

PlanningHints {
  toolDecision: ToolDecision                 // ANSWER|CLARIFY|SEARCH_HANDOFF|ABORT|HANDOFF
  shouldAsk: boolean
  clarificationCandidate: { field, reason, detail } | null  // no ar/en copy
  blockingFields: string[]
  searchHandoff: SearchHandoffMeta           // executeSearch/invokeGateway always false
  assumptions: PlanningHintsAssumption[]     // source: "assumed"
  confirmedFields: string[]
  nextPlannerAction: NextPlannerAction
  executeSearch: false
  invokeGateway: false
}
```

### 4.3 ToolDecision (exact five outcomes — shipped)

```text
type ToolDecision =
  | 'ANSWER'           // answer / advise directly without search
  | 'CLARIFY'          // ask ≤1 clarification
  | 'SEARCH_HANDOFF'   // search eligibility metadata only (NO execute)
  | 'ABORT'            // abort short-circuit; no clarify / no search
  | 'HANDOFF'          // non-search planning handoff (e.g. compare / visa)
```

| Decision | Meaning | Execute search/gateway? |
| --- | --- | --- |
| `ANSWER` | Advise / recommend without search | **No** |
| `CLARIFY` | Ask ≤1 question | **No** |
| `SEARCH_HANDOFF` | `searchEligible=true`; emit handoff **decision** meta only | **No** |
| `ABORT` | Abort path; preserve memory; no ask / no search | **No** |
| `HANDOFF` | Non-search planning handoff (compare / visa guidance) | **No** |

**Authority:** `ToolDecisionBridge` (T6) → aggregated by `PlanningHintsBuilder` → sealed by `BrainRouterDecisionContract` via `PlanReasonTurn`.  
**Legacy name map (docs only — do not emit as Phase 2 enum):**  
`REASON_MORE`→removed (no in-turn reasoner loop in Phase 2 compile stack); `SAFE_FALLBACK`→sealed `ANSWER`/`ABORT` recovery in `PlanReasonTurn`; executable `search`→**removed** (use `SEARCH_HANDOFF` with `executeSearch=false`).

### 4.4 Contract version seeds

| Contract | Version seed |
| --- | --- |
| planReasonTurn | `sprint89-phase2-planning-1` |
| MissingInformationPlanner | `missing-information-planner@1.x` |
| Clarification | `clarification-planner@1.x` |
| AssumptionPolicy | `assumption-engine@1.x` |
| ConfidenceGates | `confidence-gates@1.x` |
| TravelReasoner (structured) | `travel-reasoner@1.x` |
| ToolDecision (five-way) | `tool-decision-engine@1.x` |
| SearchHandoffDecision | `search-handoff-decision@1.0.0` |
| Explainability | `explainability@1.x` |
| PlanReasonTurn recovery | inlined in `sprint89-phase2-planning-1` |

Phase 1 contracts A–E, I–K are **inputs**, not reimplemented.

---

## 5. Contracts mapping

| Contract | Phase 2 action |
| --- | --- |
| A–E, I–K (Phase 1) | **Consume only** |
| F MissingInformationPlanner | **Implement** |
| G ClarificationPolicy | **Adapt CM module** via ClarificationBridge — do not duplicate |
| H AssumptionEngine | **AssumptionPolicy** + MemoryManager `source: assumed` |
| O ConversationPlanner | **ConversationMoveBridge** (moveType); not foundation product spine |
| P TravelReasoner | **Extend** structured summary / recommendedAction |
| R ConfidenceEngine | **ConfidenceGates** pure functions |
| S Value-before-question | **Meta only** via PlanReasonTurn `ValueBeforeQuestionMeta` (CM later) |
| T ToolDecisionEngine | **Five-way** ToolDecisionBridge — never execute |
| U SearchHandoffDecision | Emit `blocked_*` / `early_return_locked` only |
| AG Explainability | User-safe nodes only |
| AI FailureRecovery | Preserve memory → sealed `ANSWER`/`ABORT` in PlanReasonTurn |
| AL BrainTurnResult | Additive `planning` meta |

---

## 6. Data flow

```text
ConversationInput (text | voice_transcript — same contracts)
  → understandTurn (Phase 1)
       intent, entities+facts, references, state(knownSlots, supersededFields),
       memoryProposals, provenance, isCorrection, abort
  → if abort:
       MemoryManager.preserveOnAbort
       planReasonTurn({ abort: true }) → no-op planningHints only
         (acknowledge_abort; no slot clears; no re-extract)
       CM renders abort hints
       return (toolBatch null)
  → MemoryManager.apply entity facts (corrections override)
  → planReasonTurn (Phase 2)  [NO re-extract]
       0. Bind SoT = understanding.state.knownSlots (+ memory mirror)
          Ignore superseded prior values; corrections already applied in Phase 1
       1. MissingInformationPlanner(goal, knownSlots, intent, provenance)
          — genuinely missing only (see §9)
       2. AssumptionPolicy.propose (non-blocking gaps only)
          — apply via MemoryManager source:"assumed" if accepted
       3. ConfidenceGates → canSearch, shouldClarify, searchEligible
       4. ValueBeforeQuestionMeta (strategy only)      ← CM formats later
       5. ClarificationBridge.decide (≤1 or 0; never ask known/assumed/bookingOnly)
       6. ConversationMoveBridge → moveType
          default value_then_clarify when shouldAsk && value possible
       7. TravelReasonerBridge → structured recommendedAction / conflicts
          — no in-turn REASON_MORE loop; ToolDecisionBridge is single-pass
       8. ToolDecisionBridge → exactly one of five outcomes
       9. SearchHandoffDecision.from(...)
          blocking ⇒ blocked_insufficient_information + mustNotInvoke
          else ⇒ early_return_locked
          NEVER soft_enrich_continue in Phase 2
      10. ExplainabilityBridge (user-safe)
      11. PlanReasonTurn recovery on errors → sealed ANSWER/ABORT; preserve knownSlots/memory
  → CM.run(planningHints)  // reply author ONLY; must not re-decide plan
  → BrainRouter result: toolBatch null + meta
```

**Invariants in flow**

- Steps 8–9 never call `src/core/providerGateway` or search tools.  
- No DomainIntelligence.execute in Phase 2.  
- Voice and text share this path after transcript→text.

---

## 7. State transitions

### 7.1 Cognitive states (testable pure mapping)

| Inputs (summary) | Cognitive state |
| --- | --- |
| abort | Finished |
| recovery engaged | Recovery |
| toolDecision=CLARIFY / shouldClarify | Clarifying → Waiting (after emit) |
| toolDecision=SEARCH_HANDOFF | Search eligibility meta (no execute) |
| toolDecision=ANSWER + value | Advising → Waiting |
| toolDecision=HANDOFF | Advising/Waiting — **not** Searching execute |
| toolDecision=ABORT | Abort short-circuit |

**Forbidden:** setting Preview stage `searching` on any Phase 2 success path that implies execute. HANDOFF does **not** enter Searching execute state.

### 7.2 PreviewConversationStage

| Cognitive | Preview stage |
| --- | --- |
| Reasoning / Advising | `exploring` |
| Clarifying / Waiting | `refining` |
| Recovery | `recovered` / `fallback` |
| Searching execute | **never** in Phase 2 |

### 7.3 Recovery / abort / memory

- Recovery **preserves** AgentMemory, knownSlots, provenance.  
- Abort: no trip invalidation; no Phase 2 clears; Phase 1 `preserveOnAbort` remains.  
- Corrections: Phase 1 overrides; Phase 2 recomputes missing from **post-correction** knownSlots only.

Phase 2 uses shared state helpers (`advanceUnderstandingState` / mappers) so Searching execute is never set.

---

## 8. Decision engine flow

```text
UnderstandingTurnResult + knownSlots (SoT)
        │
        ▼
MissingInformationPlanner ──► blocking / deferrable / bookingOnly
        │
        ▼
AssumptionPolicy (source: assumed only)
        │
        ▼
ConfidenceGates ──► canSearch / shouldClarify / searchEligible
        │
        ├─ ValueBeforeQuestionMeta (strategy; CM formats later)
        │
        ├─ Clarification (≤1; skip known/assumed/bookingOnly)
        │
        ▼
Conversation moveType (value_then_clarify default when ask+value)
        │
        ▼
TravelReasoner (structured) ── not a Phase 2 ToolDecision loop
        │
        ▼
ToolDecision (exactly one):
  ANSWER | CLARIFY | SEARCH_HANDOFF | ABORT | HANDOFF
        │
        ▼
SearchHandoffDecision
  blocked_insufficient_information  OR  early_return_locked
        │
        ▼
planningHints → ConversationManager (render only)
```

**Mandatory property tests**

1. `blocking.length > 0` ⇒ `toolDecision ≠ HANDOFF`  
2. `blocking.length > 0` ⇒ handoff `blocked_insufficient_information` + `mustNotInvokeSearchOrGateway`  
3. `questionCount ≤ 1`  
4. Assumption never written as `confirmed` / `user_provided`  
5. Abort ⇒ no Phase 2 memory clears  
6. `knownSlots.field` confirmed ⇒ field ∉ `clarification.mergedFields`  
7. Value emitted when `(sufficientForAdvise || destination known) && !abort && !safetyBlock`  
8. When `planningHints` present, CM does not invent a different shouldAsk/toolDecision  
9. Zero providerGateway / search execute calls  

---

## 9. MissingInformationPlanner

### 9.1 “Genuinely missing”

A field is missing **only if**:

- Not present in **knownSlots** (SoT) at usable confidence, **and**  
- Not accepted as a safe assumption for the current goal, **and**  
- Not `bookingOnly` (passport / payment / identity), **and**  
- Not already answered in-session, **and**  
- Not a **superseded** prior value (use `supersededFields` / post-correction slots).

### 9.2 Outputs

```text
{
  missing: string[]
  blocking: string[]       // blocks SEARCH_HANDOFF eligibility
  deferrable: string[]
  bookingOnly: string[]    // NEVER blocking for explore/advise/handoff eligibility
  sufficientForAdvise: boolean
  sufficientForSearch: boolean  // eligibility only — does not execute
}
```

### 9.3 Default blocking sets (interim)

| Goal / domain | Typical blocking for SEARCH_HANDOFF eligibility |
| --- | --- |
| advise / explore | usually none |
| search flight (eligibility) | origin, destination, usable dates/flex |
| search hotel | destination, stay window/nights |
| search car | pickup location, dates |
| compare destinations | ≥2 candidates or open explore |
| visa_guidance | nationality for specific guidance — not search execute |

Safely assumed fields are **not** asked again for advise; they still do **not** alone authorize HANDOFF unless ConfidenceGates allowlist says so.

### 9.4 Acceptance

- Passport/payment never in `blocking`  
- Corrections recompute from latest knownSlots  
- Behavior Spec §4.1–4.3 aligned  
- No re-extract from raw text inside this planner  

---

## 10. Clarification (ClarificationBridge)

### 10.1 Rules

- Max **1** user-facing question per reply; prefer **0**  
- `mergedFields.length ≥ 1` still yields **one** question string  
- Never re-ask confirmed knownSlots  
- `avoidReasons` includes `already_known`, `assumed_safe`, `booking_deferred`  
- After **2** failed attempts on same gap → change strategy (examples/defaults)  
- No workflow vocabulary  

### 10.2 Outputs

```text
{
  shouldAsk: boolean
  question: { ar, en, mergedFields[] } | null
  avoidReasons: string[]
  questionBudgetUsed: 0 | 1
}
```

### 10.3 Owner

Phase 2 is the **only** clarify decision owner on the preview path. CM formats the question text if needed but **must not** select a different field/budget when hints exist.

---

## 11. Conversation moves + Value-first

### 11.1 moveType

| moveType | When |
| --- | --- |
| `value_then_clarify` | **Default** when shouldAsk && value possible |
| `advise_only` | Sufficient for advice; no ask |
| `clarify_only` | **Banned except** valueFirst empty AND safety/incomplete utterance; tests assert rarity |
| `acknowledge_correction` | Phase 1 `isCorrection` |
| `acknowledge_abort` | abort |
| `wait` | Ball in traveler’s court |
| `recover` | sealed ANSWER / ABORT |

### 11.2 Value-before-question (mandatory)

If value is possible, Phase 2 **must** populate `valueFirst` before/with clarify packaging. Question-only turns when value exists = defect (G01).

### 11.3 CM injection (single mechanism)

Additive API, e.g. `runConversationManagerTurn(input, { enabled: true, planningHints })`:

- When `planningHints` present: CM **skips** internal missing/clarify/tool/value **selection**; uses hints for ResponseGenerator.  
- When absent (non-preview / legacy tests): existing CM behavior unchanged.  

This is the resolution of **dual CM re-decide** (blocker P2-6).

---

## 12. TravelReasoner (structured)

```text
{
  recommendedAction: 'clarify' | 'advise_without_search' | 'wait' | 'compare' | 'recommend' | 'reason_more'
  // NOTE: no 'search' action in Phase 2
  conflicts: [{ fields, summary }]
  reasoningSummary: { conclusions: string[], tradeoffs: string[] }  // user-safe only
  usedAssumptions: string[]
  destinationKey: string | null
}
```

**Constraints**

- No provider calls  
- **No Destination Knowledge content expansion required for Phase 2 DoD** (read existing data only)  
- No geo-hardcoded ranking  
- Must not recommend search execute when `canSearch === false`  
- SEARCH_HANDOFF eligibility expressed via ToolDecision/`searchEligible`, not reasoner side effects  
- Traces for eval/shadow only (redacted); **no CoT** in outputs  

Explainability derives only from `reasoningSummary` + valueFirst (+ existing DK explain nodes if already present).

---

## 13. ToolDecisionEngine (five-way)

See §4.3. Hard rules:

| Condition | Decision |
| --- | --- |
| blocking ≠ ∅ | `CLARIFY` or `ANSWER` (advise without search) — **never** `HANDOFF` |
| shouldClarify && value possible | typically `CLARIFY` with move `value_then_clarify` |
| Advise-only / sufficient advise | `ANSWER` |
| Search eligibility (meta only) | `SEARCH_HANDOFF` (`executeSearch=false`) |
| sufficientForSearch && search-shaped intent && !blocking | `HANDOFF` (**meta only**) |
| Safety / planner failure | sealed `ANSWER` (or `ABORT` if abort-compatible) |
| Abort | `ANSWER` or skip Phase 2 (acknowledge_abort) — **never** clear memory |

`searchEligible === (toolDecision === 'HANDOFF')`  
`HANDOFF` never sets `toolBatch`, never calls gateway, never emits `soft_enrich_continue`.

---

## 14. Explainability

- Outputs: `whyTop[]`, `alternatives[]`, `evidenceRefs[]` (opaque)  
- Forbidden: CoT, tool traces, flags, stages, secrets, provider payloads  
- Acceptance: red-team fixture rejects CoT/stage leakage  
- Locale: CM renders ar/en user-safe strings from structured nodes  

---

## 15. Search handoff (decision-only)

| Condition | Hint |
| --- | --- |
| blocking / insufficient | `blocked_insufficient_information` + `mustNotInvokeSearchOrGateway: true` |
| otherwise (Phase 2 success) | `early_return_locked` |
| Phase 2 | **Never** emit executable `soft_enrich_continue` |

- Option A execute = Sprint 90  
- `toolBatch: null` always on Brain success in Phase 2  
- No DomainIntelligence.execute; no Phase 3 contract **implementation** beyond reading existing types  
- Existing `src/core/providerGateway` reused later; **no parallel fabric** now or in Phase 2  

---

## 16. Confidence model

Levels: `confirmed` | `high_confidence_inferred` | `medium_confidence_inferred` | `assumption` | `unknown` | `conflicting` | `stale`  
**Level wins** over numeric score.

| Gate | Rule |
| --- | --- |
| canSearch / searchEligible | all blocking fields `confirmed` OR (`high_confidence_inferred` + AssumptionPolicy allowlist) |
| medium dates | **cannot** authorize HANDOFF (default) |
| conflicting | canSearch=false; shouldClarify=true |
| Test defaults (non-normative companions) | high ≥ 0.75; medium ≥ 0.55 |

ConfidenceGates and state mapping are **pure functions** with table-driven tests.

---

## 17. Assumption policy

### Allowed (reversible, `source: "assumed"`)

- Cabin economy if unspecified (advise path)  
- Soft currency from locale preference when empty  
- Pace assumptions: propose only in Phase 2 (itinerary apply = Phase 4)

### Rejected

- Nationality; invented exact dates to force HANDOFF; invented budgets  
- Origin/destination as assumed-confirmed  
- Any write as `user_provided` / `confirmed`  
- High-harm / irreversible fields  

### Promotion

Promotion to confirmed **only** via Phase 1 user confirmation/correction paths (`isConfirmation` / explicit restatement). **Phase 2 cannot promote.**

### Commit path

Extend Phase 1 `UnderstandingMemoryManager` with assumed-source apply (not a third store):

1. Propose in PlanReasonTurnResult  
2. Apply `source: "assumed"`, `reversible: true`, confidence level `assumption`  
3. Soft-surface via CM using hints.assumptions  

---

## 18. Failure recovery

| Failure | Action |
| --- | --- |
| MissingInformationPlanner throw | Conservative blocking; CLARIFY once; preserve memory |
| Reasoner timeout | Heuristic structured summary; `FALLBACK_USED`; ToolDecision sealed `ANSWER` (recovery) |
| Clarification asks >1 | Clamp to 1; INTERNAL_CONTRACT_VIOLATION logged |
| ToolDecision SEARCH_HANDOFF while blocking | Force CLARIFY/ANSWER; test must fail if SEARCH_HANDOFF emitted |
| CM empty/disabled | BrainRouter fallback to current planner |
| Safety block | sealed ANSWER/ABORT; no tools |

**Preserve** AgentMemory + knownSlots + provenance on recovery.  
Abort + failure **must not** call trip invalidation.

User-facing: calm consultant copy via CM; no stack traces; no silent failure (G05).

---

## 19. Test strategy

### 19.1 Unit

- MissingInformationPlanner matrices (known / assumed / bookingOnly / superseded / corrections)  
- Clarification ≤1, merge, avoidReasons, attempt counter  
- Assumption allow/deny + `source: assumed`  
- ConfidenceGates tables  
- ToolDecision five-way + blocking ⇒ ¬SEARCH_HANDOFF  
- SearchHandoff emission matrix  
- Reasoner respects canSearch; no `search` action  
- Authority: planningHints present ⇒ CM selection skipped (mock)  

### 19.2 Contract

- planReasonTurn envelope boundary  
- Error taxonomy on failures  
- Explainability CoT rejection  

### 19.3 Golden / behavior

| ID | Focus | Locales |
| --- | --- | --- |
| G01/G02 | Value-first; zero ask when enough | **ar + en** |
| G05 | Safe fallback | ar + en |
| G06 | Clarify-before-search (Morocco-only insufficient) | **ar + en** |
| G07 | ¬SEARCH_HANDOFF / blocked handoff when blocking | ar + en |
| G08 | Assumption not promoted | ar + en |
| G09 | Correction then replan missing (e.g. Dubai→Morocco) | **ar + en** |
| G10 | Abort skips Phase 2 memory mutation | ar + en |
| — | Ambiguity / reference unresolved → CLARIFY | ar + en |

### 19.4 Regression (mandatory in verify)

- `sprint89.phase1.understanding.test.ts`  
- `sprint89.phase1.corrections.test.ts` (destination/dates/travelers/stale refs/abort/provenance)  
- Sprint 86 preview + Sprint 88 preview contracts as needed  

### 19.5 Integration

- BrainRouter preview ON: understand → memory → planReason → CM; toolBatch null; gateway spy = 0  
- preview OFF: planTurn unchanged  
- Flags frozen/OFF unchanged  

### 19.6 Scripts

```bash
npm run sprint89-phase2:verify
# includes phase2 suites + phase1 understanding + phase1 corrections
npm run brain-eval:verify
npm run test:run
npm run typecheck && npm run lint
```

---

## 20. Migration strategy

### 20.1 Task sequence (after re-APPROVE)

See §27 for checkpoints. Summary:

T1 types (deferred/in-module) → T2 MissingInformationPlanner → T3 AssumptionPolicy → T4 ConfidenceGates → T5 ClarificationBridge → T6 ToolDecisionBridge → T7 PlanningHintsBuilder → T8 BrainRouterPlanningAdapter → T9 BrainRouterDecisionContract → T10 PlanReasonTurn (+ recovery) → T11 Goldens/regressions (not started) → T12 Notes/DoD. BrainRouter runtime wire is **out of T2–T10** (separate authorization).

### 20.2 Compatibility

| Surface | Strategy |
| --- | --- |
| Phase 1 understandTurn | Unchanged API; consumed |
| knownSlots | SoT for planning |
| CM | Reply author; `planningHints` injection |
| `brainV1Preview.planning` | Additive optional meta |
| Flags | No default enablement |
| Sprint 90 | May read `searchEligible` + ADR; Phase 2 does not execute Option A |

### 20.3 Rollback

Preview flag OFF ⇒ no Phase 2 path. Phase 2 throw ⇒ BrainRouter fallback current planner; memory preserved.

### 20.4 Explicit non-migrations

- No production preview enablement  
- No parallel provider fabric  
- No booking/payment/UI/voice providers  
- No Phase 3 DomainIntelligence execute / search abstraction implementation  
- No DK content expansion as Phase 2 requirement  

---

## 21. BrainRouter integration sketch

```text
routeBrainPreviewTurn:
  if preview OFF → current
  understanding = understandTurn(...)
  if understanding.intent.primaryIntent === 'abort':
       applyEntityFacts(..., { preserveOnAbort: true })  // no mutation
       planning = planReasonTurn({
            understanding, memory, conversationState: understanding.state,
            abort: true, locale, priorClarificationAttempts,
       })  // Phase 2 abort no-op: planningHints only; no slot writes
       cm = runCM(..., { planningHints: planning.planningHints })
       return build(toolBatch:null, early_return_locked, understanding + planning meta)
  apply memory from understanding (corrections override)
  planning = planReasonTurn({
       understanding,
       memory,
       conversationState: understanding.state,
       abort: false,
       priorClarificationAttempts,
       locale,
  })
  cm = runCM(..., { planningHints: planning.planningHints })
  return build(
       toolBatch: null,
       searchHandoffHint: planning.searchHandoff,
       understanding meta,
       planning meta summary only,
  )
```

---

## 22. Public interfaces (minimal)

| Export | Public? |
| --- | --- |
| `planReasonTurn` / `createPlanReasonTurn` | **Yes** |
| `MissingInformationPlanner` | **Yes** |
| `decideSearchHandoff` | **Yes** |
| `PHASE2_PLANNING_CONTRACT_VERSION` | **Yes** |
| ToolDecision type (five-way) | **Yes** |
| Bridges (Clarification/ToolDecision/…) | **No** (test-visible OK) |
| Second “Brain” facade | **No** |

Re-export minimal set from `brain/v1/index.ts`.

---

## 23. Documentation deliverables

| Doc | When |
| --- | --- |
| This plan (T0) | Now |
| `SPRINT89_PHASE2_NOTES.md` | T12 closeout |
| AI Contracts amend only if enum/fields require | Same impl PR |
| ADR addendum | Only if handoff policy changes — **avoid in Phase 2** |

---

## 24. Definition of Done — Phase 2 (updated)

- [ ] Sequential BrainRouter: understand → memory → planReason → CM  
- [ ] Single planning authority = planReasonTurn; CM reply-only with hints  
- [ ] Consumes Phase 1 UnderstandingTurnResult / knownSlots / provenance; **no re-extract**  
- [ ] MissingInformationPlanner: genuinely missing only; bookingNeverBlocking  
- [ ] Clarification ≤1; value-before-question mandatory; no re-ask known  
- [ ] Corrections/abort/recovery preserve Phase 1 guarantees  
- [ ] Assumptions `source: assumed` only; no silent confirm  
- [ ] TravelReasoner structured + explainability without CoT  
- [ ] ToolDecision exactly five-way; blocking ⇒ ¬SEARCH_HANDOFF  
- [ ] SearchHandoff decision-only; `toolBatch: null`; no gateway/search/provider execute  
- [ ] No Phase 3 execute / no DK expansion DoD / no parallel fabric  
- [ ] Flags OFF; freeze green  
- [ ] Acceptance: ar+en, multi-turn corrections, missing-data, ambiguity, abort, safe fallback, Phase 1 correction regressions  
- [ ] `sprint89-phase2:verify` + full `test:run` green  
- [ ] Phase 2 notes published; PR mergeable  

---

## 25. Risks & decisions

| ID | Topic | Decision |
| --- | --- | --- |
| P2-1 | `searchEligible` / HANDOFF without execute | **Yes** — meta only |
| P2-2 | Bypass CM for replies? | **No** — CM only response author |
| P2-3 | Medium-confidence dates → HANDOFF | **false** |
| P2-4 | DK content expansion | **Not in Phase 2 DoD** |
| P2-5 | Branch suffix `-71ec` | Optional for impl PR |
| P2-6 | Dual CM re-decide | **Resolved** via mandatory `planningHints` injection (§11.3) |
| P2-7 | ToolDecision naming | **Resolved** — five-way enum (§4.3) |

### Remaining risks (non-blocking for plan approval)

| Risk | Mitigation |
| --- | --- |
| CM API change surface area | T5 design spike gate before coding |
| Foundation pipeline.ts confusion | Explicit ban as product path; docs + lint/review |
| Hint/copy quality regressions | G01/G02 ar+en + CM snapshot tests |

---

## 26. Approval checkpoint

**T0 (this document) complete.**  

No T1+ runtime code until architecture **re-APPROVE**.  
No Search execute. No flag enablement. No Phase 3 start.

---

## 27. Task sequence, checkpoints, per-task DoD

| Task | Scope | Checkpoint | Task DoD |
| --- | --- | --- | --- |
| **T0** | Plan amendments (this doc) | Re-APPROVE plan | §F edits applied; blockers resolved in writing |
| **T1** | Shared PlanReason / ToolDecision types (in-module; no separate `types.ts` required) | Review types | Compiles; no BrainRouter behavior change |
| **T2** | MissingInformationPlanner + unit matrices | Review | known/assumed/bookingOnly/superseded/corrections covered; no re-extract |
| **T3** | AssumptionPolicy + MemoryManager `source: assumed` | Review | No silent confirm; abort preserve still green |
| **T4** | ConfidenceGates pure tables | Review | medium dates ∉ SEARCH_HANDOFF; conflicting⇒clarify |
| **T5** | ClarificationBridge ≤1 + **CM injection design** | **Design review gate** | Injection API design-only; no CM runtime wire |
| **T6** | ToolDecisionBridge five-way (`ANSWER`/`CLARIFY`/`SEARCH_HANDOFF`/`ABORT`/`HANDOFF`) | Review | blocking⇒¬SEARCH_HANDOFF; executeSearch/invokeGateway always false |
| **T7** | PlanningHintsBuilder (machine-readable hints) | Review | No copy; no toolBatch; no execute |
| **T8** | BrainRouterPlanningAdapter (normalize only) | Review | Preserves planner decisions; no BrainRouter runtime |
| **T9** | BrainRouterDecisionContract (sealed) | Review | Immutable decision contract; capabilities all false |
| **T10** | PlanReasonTurn pure orchestration + recovery | Review | assume→missing order; abort/correction/recovery; memory preserved; **no BrainRouter wire** |
| **T11** | Goldens G06–G10 + ar/en + phase1 corrections in verify | Review | phase2+phase1 verify + test:run green — **not started** |
| **T12** | SPRINT89_PHASE2_NOTES + checklist | Merge gate | Phase 2 DoD §24 complete |

---

## Appendix A — Abort / correction / insufficient sequences

```text
ABORT:
  understand(abort) → preserveOnAbort
  → planReasonTurn({ abort: true })  // planningHints only; no slot writes
  → CM acknowledge_abort → done

CORRECTION:
  understand(correct → knownSlots overridden, supersededFields set)
  → memory apply corrected facts
  → planReason recomputes missing from NEW knownSlots only
  → CM acknowledge_correction + value/clarify per decisions

INSUFFICIENT FOR HANDOFF:
  understand → memory → planReason
  → blocking ≠ ∅ → ToolDecision CLARIFY|ANSWER → handoff blocked_* → CM value_then_clarify
  → toolBatch null; no gateway
```

---

## Appendix B — ToolDecision ↔ state (optional map)

| ToolDecision | Cognitive | Preview stage |
| --- | --- | --- |
| ANSWER | Advising | exploring |
| CLARIFY | Clarifying→Waiting | refining |
| SEARCH_HANDOFF | Advising/Waiting (eligible meta only) | exploring (not searching) |
| ABORT | Abort | aborted |
| HANDOFF | Non-search planning handoff | exploring |

---

**— End of Sprint 89 Phase 2 Implementation Plan (T0) —**
