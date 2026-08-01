# Sprint 88 — Implementation Plan

**Status:** **COMPLETE** — closed under Architecture Gate PASS · tag `sprint88-complete`  
**Architecture gate:** PASS (`docs/SPRINT88_ARCHITECTURE_GATE_REPORT.md`)  
**Completion report:** `docs/SPRINT88_COMPLETION_REPORT.md`  
**Baseline:** `brain-foundation-complete-sprint-81-87` + revised  
`docs/ARCHITECTURE_TRAVEL_INTELLIGENCE_ENGINE_SPRINT88-95.md`  
**Turn owner:** `travelAgentService.planTurn` (unchanged)  

**Flags (must remain OFF throughout Sprint 88):**

| Flag | Required state |
| --- | --- |
| `ai.brain.v1` | OFF (recovery-frozen) |
| `ai.brain.v1.preview` | OFF (default; production hard-blocked) |

**Non-goals / forbidden in Sprint 88:**

- Rebuild ConversationManager, ValueFirstPlanner, ClarificationPolicy, BrainRouter core, or L1/L2
- Introduce `ai.tie.v1` or any second soft-pilot flag
- Implement Search Handoff into live `planTurn` search (ADR + tests of current early-return only)
- Domain search implementation (Flight/Hotel/…)
- New provider abstraction / parallel gateway
- UI, Voice, STT/TTS, booking, payments, production enablement

---

## 0. Sprint goal

Establish the **minimal scaffolding** for Travel Intelligence under the existing preview path:

1. Evolve **Preview Orchestrator (BrainRouter+)** contracts without rebuilding L1/L2  
2. Deepen **memory adapters** (AgentMemory remains source of truth)  
3. Decide and document **Search Handoff** (Option A vs B) while locking current early-return behavior in tests  
4. Land **golden evaluation** + **shadow telemetry** skeletons (default OFF)  
5. Publish **required interfaces only** (`DomainIntelligence`, ranking config keys, offer normalization types)

**Exit criterion:** Sprint 88 merged with flags OFF; ADR recorded; harnesses runnable in CI; no production behavior change when flags OFF.

---

## 1. Task breakdown

### Task 1 — Search Handoff ADR + early-return lock tests
**Effort:** M (relative 5)  
**Status:** Complete (awaiting review before Task 2)

| Item | Detail |
| --- | --- |
| Goal | Choose Option A (soft-enrich then continue) vs Option B (deferred search stage); document decision; freeze today’s early-return as normative until Sprint 90 |
| Work | Write `docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md`; add tests asserting preview success → `toolBatch: null` and no search/gateway; document constraints (reuse existing tools + `src/core/providerGateway`) |
| **Hard gate (required)** | If the conversation does not yet contain sufficient information, the planner **must ask a clarification question first** and **MUST NOT** invoke Search or any Provider Gateway |
| Out | No handoff implementation in `planTurn` |
| Depends on | Architecture ADD §2.5 (none code) |
| Unlocks | Tasks 5–6 clarity; Sprint 90 |
| Artifacts | `docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md`; `src/lib/__tests__/sprint88.searchHandoff.task1.test.ts` |

### Task 2 — Preview contracts + Domain / Ranking / NormalizedOffer interfaces
**Effort:** M (relative 5)  
**Status:** Complete  
**Includes plan Task 4 interface work** (combined per kickoff approval)  
**Checkpoint prior:** `sprint88-task1-complete`

| Item | Detail |
| --- | --- |
| Goal | Extend preview **result/session contracts** + publish DomainIntelligence / RankingConfig / NormalizedOffer **interfaces only** without changing default-OFF behavior |
| Work | `src/lib/brain/v1/contracts/*`; optional meta fields on `brainV1Preview`; docs `SPRINT88_PREVIEW_CONTRACTS.md` |
| Out | No ConversationManager / ValueFirstPlanner / ClarificationPolicy rewrite; no provider execute; no Search Handoff impl |
| Depends on | Task 1 ADR (complete; tag `sprint88-task1-complete`) |
| Unlocks | Tasks 3, 6, 7 |
| Artifacts | `src/lib/brain/v1/contracts/`; `docs/SPRINT88_PREVIEW_CONTRACTS.md`; `src/lib/__tests__/sprint88.previewContracts.task2.test.ts` |

### Task 3 — Memory adapters (working / preference / trip)
**Effort:** M (relative 8)  
**Status:** Complete (awaiting review before next task)

| Item | Detail |
| --- | --- |
| Goal | Adapter layer mapping logical stores → AgentMemory + provenance; trip isolation on new `planId` |
| Work | `src/lib/brain/v1/preview/memory/*` — Working / UserPreference / Trip adapters + provenance; reuse `privacy.ts` sanitize; **not wired** into BrainRouter/planTurn |
| Out | No persistence / Supabase / DB; no second Memory Fabric SoT; no Brain execution changes |
| Depends on | Task 2 complete |
| Unlocks | Golden evals that assert memory continuity |
| Artifacts | `src/lib/brain/v1/preview/memory/`; `docs/SPRINT88_MEMORY_ADAPTERS.md`; `src/lib/__tests__/sprint88.memoryAdapters.task3.test.ts` |

### Task 4 — Required interfaces only
**Effort:** S–M (relative 5)  
**Status:** Folded into Task 2 (per kickoff) — do not re-implement

| Item | Detail |
| --- | --- |
| Goal | Type-level contracts for DomainIntelligence, ranking weights config keys, offer normalization checklist |
| Work | Delivered under Task 2 (`src/lib/brain/v1/contracts/`) |
| Out | No Flight/Hotel domain execute(); no new provider bus |
| Depends on | ADD §5, §13.3, §14 |
| Unlocks | Sprint 90+ implementations |

### Task 4 — Golden evaluation framework skeleton
> User Task 4 (was plan Task 5). Plan Task 4 interfaces remain folded into Task 2.  
**Effort:** M (relative 8)  
**Status:** Complete (awaiting review; do not start shadow Task 5 without approval)

| Item | Detail |
| --- | --- |
| Goal | Runnable golden conversation harness with fixtures; CI-safe; flag OFF by default |
| Work | `src/lib/brain/v1/eval/*` contracts + runner + G01–G05 fixtures; `npm run brain-eval:verify`; docs |
| Out | Not full domain coverage (that’s 90–94); no production wiring; no Search Handoff |
| Depends on | Tasks 1–3 complete |
| Unlocks | Quality gate for later sprints |
| Artifacts | `src/lib/brain/v1/eval/`; `docs/SPRINT88_GOLDEN_EVALUATIONS.md`; `src/lib/__tests__/sprint88.goldenEval.task4.test.ts` |

### Task 5 — Shadow telemetry skeleton
**Effort:** M (relative 5)  
**Status:** Complete (awaiting review; Task 6 not started)

| Item | Detail |
| --- | --- |
| Goal | Telemetry **infrastructure** for preview evaluation metadata only (no production registration) |
| Work | `src/lib/brain/v1/preview/telemetry/*` contracts, emitter interface, in-memory sink, redaction; `npm run brain-shadow:verify`; docs |
| Out | No runtime wiring into BrainRouter/`planTurn`; no OTel/network/persistence; no Search Handoff |
| Depends on | Tasks 1–4 complete |
| Unlocks | Sprint 94 SLOs / later dual-run harness |
| Artifacts | `src/lib/brain/v1/preview/telemetry/`; `docs/SPRINT88_SHADOW_TELEMETRY.md`; `src/lib/__tests__/sprint88.shadowTelemetry.task5.test.ts` |

### Task 6 — Final verification & Architecture Gate
**Effort:** S (relative 3)  
**Status:** Complete (awaiting review; Task 7 not started)

| Item | Detail |
| --- | --- |
| Goal | Final verification layer only — no new product functionality |
| Work | Re-run Sprint 88 suites + typecheck/lint/build/freeze; validate ADR/contracts/adapters/evals/telemetry isolation; Architecture Gate Report |
| Out | No runtime/production code changes; no flag enablement |
| Depends on | Tasks 1–5 complete |
| Artifacts | `docs/SPRINT88_ARCHITECTURE_GATE_REPORT.md` |

### Task 7 — Final freeze & Sprint closeout
**Effort:** S (relative 3)  
**Status:** Complete — Sprint 88 CLOSED

| Item | Detail |
| --- | --- |
| Goal | Official Sprint 88 closeout; final audit + verification; tag `sprint88-complete` |
| Work | Document inventory audit; re-run Sprint 88 + CI checks; `docs/SPRINT88_COMPLETION_REPORT.md`; git tag |
| Out | No new runtime functionality |
| Depends on | Task 6 Architecture Gate PASS |
| Artifacts | `docs/SPRINT88_COMPLETION_REPORT.md`; tag `sprint88-complete` |

---

## 2. Execution order

```text
Task 1  Search Handoff ADR + early-return tests
   │
   ├──────────────┐
   ▼              ▼
Task 2          Task 4
Preview         Interfaces
contracts       ( Domains / ranking / offers )
   │              │
   ▼              │
Task 3            │
Memory adapters   │
   │              │
   └──────┬───────┘
          ▼
       Task 5  Golden evaluation skeleton
          │
          ▼
       Task 6  Shadow telemetry skeleton
          │
          ▼
       Task 7  Docs + verify + freeze gates
          │
          ▼
       Sprint 88 complete (flags OFF) → wait for Sprint 89
```

**Parallelism:** After Task 1, Task 2 and Task 4 may proceed in parallel. Task 3 follows Task 2. Tasks 5–6 after 2–3 (and ideally 4). Task 7 last.

**Hard stop:** Do **not** start Task 1 until this plan is explicitly approved.

---

## 3. Dependencies

### 3.1 External / product

| Dependency | Status |
| --- | --- |
| Architecture ADD revised & approved | Done |
| Recovery freeze / `planTurn` owner | Must remain unchanged |
| Existing preview soft-wire (Sprint 86–87) | Reuse |
| `src/core/providerGateway` | Reference only in Sprint 88 (no parallel bus; no required behavior change) |
| Supabase / UI / Voice / payments | Out of scope |

### 3.2 Internal task graph

| Task | Blocked by | Blocks |
| --- | --- | --- |
| T1 ADR | Plan approval | T2 fields, T5 early-return goldens, Sprint 90 |
| T2 contracts | T1 (decision fields) | T3, T6 |
| T3 adapters | T2 | T5 |
| T4 interfaces | ADD (done); optional parallel with T2 | T5 optional; Sprint 90 |
| T5 goldens | T1, T2, T3 | T7 |
| T6 shadow | T2 | T7 |
| T7 docs/verify | T1–T6 | Merge |

### 3.3 Explicit non-dependencies (do not pull in)

- AgentOrchestrator stub product wiring (`ai.brain.v1`)
- Live Amadeus / Booking.com enablement
- Visa product / Saudi package visa
- Payment gateways (Tap / Tamara)

---

## 4. Acceptance criteria (sprint-level)

1. **Flags OFF:** `ai.brain.v1` and `ai.brain.v1.preview` default OFF; production hard-block for preview unchanged; no `ai.tie.v1`.  
2. **No L1/L2 rebuild:** Diff does not rewrite ConversationManager / ValueFirstPlanner / ClarificationPolicy control logic (adapters/contracts/tests/docs only around them).  
3. **Early-return locked:** Tests prove successful preview path returns with `toolBatch: null` and does not invoke provider search.  
4. **Search Handoff ADR:** Checked into `docs/adr/` with chosen Option A or B, constraints, and Sprint 90 implementation notes.  
5. **Memory adapters:** Working / preference / trip mapping with provenance; new `planId` does not keep prior trip offers/assumptions; privacy helpers used for log sanitization.  
6. **Interfaces only:** `DomainIntelligence`, ranking config keys, `NormalizedOffer` (or equivalent) compile; no domain `execute` hitting providers.  
7. **Golden evals:** Harness runs in CI; seed fixtures pass; question-budget and booking-deferral cases covered.  
8. **Shadow telemetry:** Schema + unit tests; dual-run only in test harness; no user-facing preview enable; no secret/PII in events.  
9. **Regression:** `npm run typecheck`, `lint`, `test:run` (relevant suites), recovery freeze tests, existing brain-preview verifies — green.  
10. **Production behavior:** With flags OFF (CI default), `/chat` path behavior unchanged vs pre-Sprint-88 main.

---

## 5. Unit tests

| Area | Cases |
| --- | --- |
| Early-return | Preview success → `toolBatch === null`; search/tool helpers not called |
| Preview contracts | Result shape includes handoff hint union / stage; backward compatible when absent |
| Memory adapters | Incremental slot update; provenance user vs assumed; trip invalidation on new `planId`; preference apply without wiping trip |
| Privacy | Adapter/telemetry sanitization strips passport/membership-like fields |
| DomainIntelligence types | Stub module typechecks; `execute` not required for Sprint 88 compile |
| Ranking config | Default weights sum/keys stable; override merge behavior |
| NormalizedOffer | Required fields present; unknown baggage/fees allowed |
| Shadow telemetry | Event builder redacts errors; no raw provider payload |
| Feature flags | Preview OFF → no BrainRouter side effects beyond existing Sprint 86 behavior |
| Freeze | `RECOVERY_TURN_OWNER`, frozen `ai.brain.v1`, no `ai.tie.v1` in registry |

---

## 6. Integration tests

| Area | Cases |
| --- | --- |
| `planTurn` + preview OFF | Identical soft path to Current Planner (existing tests remain green) |
| `planTurn` + preview ON (test bypass deploy gate only) | Early-return consultant reply; session round-trip via `providerMeta` |
| Preview throw → fallback | Silent fallback to Current Planner (existing Sprint 86 pattern) |
| Memory adapter + ConversationManager | Multi-turn refine (e.g. Morocco → Agadir) keeps planId; no L1 rewrite |
| Goldens via planTurn test harness | Seed conversations end-to-end under preview test enable |
| Production deploy target | Preview hard-blocked even if options try to enable |

**Not in Sprint 88 integration:** real provider calls, Search Handoff Option A/B execution inside `planTurn`, booking/payment.

---

## 7. Golden evaluation tests

### 7.1 Harness requirements

- Fixture directory (e.g. `src/lib/brain/v1/eval/goldens/` or `src/lib/__tests__/brain/goldens/`)  
- Each fixture: locale, turns[], expectations  
- Runner asserts structural properties (not brittle full-string equality for all prose)  
- Runnable via `npm run test:run` and optional `npm run brain-eval:verify` (if added)

### 7.2 Seed goldens (minimum)

| ID | Scenario | Expectations |
| --- | --- | --- |
| G01 | Destination explore (value-first) | Preliminary value present; questions ≤ 1 |
| G02 | Enough info / high confidence | Questions = 0 |
| G03 | Incremental refine (country → city) | planId stable; no re-ask of known destination family without conflict |
| G04 | Booking-only fields | Passport / payment_consent / traveler_identity not asked in explore stage |
| G05 | Preview failure injection | Falls back; no user-visible stack/secret |

### 7.3 Metrics recorded (for harness report)

- `questionsAsked`  
- `forceBlockingQuestion`  
- `hasDestinationExplainability`  
- `earlyReturn` / `toolBatchNull`  
- `fallbackUsed`  

---

## 8. Rollback plan

| Trigger | Action |
| --- | --- |
| CI red / freeze regression | Do not merge; fix forward or revert commit on branch |
| Post-merge defect with flags OFF | Revert Sprint 88 merge commit(s); flags already OFF so user impact should be none |
| Accidental preview enable in env | Remove `VITE_BRAIN_V1_PREVIEW`; confirm deploy-target hard block; kill switch = flag OFF |
| Adapter corrupts memory in tests only | Feature is behind preview; keep OFF; revert adapter commit |
| Telemetry noise | Disable shadow sink / remove verify hook; events must be inert when OFF |

**Rollback principle:** Sprint 88 must be **idle when flags OFF**. If default-OFF behavior changes, that is a release blocker — revert immediately.

**No production flag enablement** as part of rollback or rollout in this sprint.

---

## 9. Deliverables

| Deliverable | Path / artifact |
| --- | --- |
| This plan | `docs/SPRINT88_IMPLEMENTATION_PLAN.md` |
| Search Handoff ADR | `docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md` |
| Preview contract types / BrainRouter+ docs | under `src/lib/brain/v1/preview/` (+ types) |
| Memory adapters | under brain/v1 preview or conversation adapter paths |
| Interface modules | DomainIntelligence / ranking config / NormalizedOffer types |
| Golden eval harness + seed fixtures | tests + fixtures |
| Shadow telemetry schema + tests | lib + unit tests |
| Sprint 88 engineering notes | `docs/SPRINT88_PREVIEW_CONTRACTS.md` (or equivalent) |
| Verify script (optional) | `package.json` script e.g. `brain-eval:verify` |
| Completion report (end of sprint) | `docs/SPRINT88_COMPLETION_REPORT.md` |

**Not delivered in Sprint 88:** Search Handoff implementation, domain execute paths, provider gateway rewrite, UI/Voice, flag ON in any shared environment.

---

## 10. Estimated effort (relative)

Calendar days/weeks are intentionally omitted. Effort uses **relative points** (Fibonacci-like) for sizing only.

| Task | Relative effort | Complexity notes |
| --- | --- | --- |
| T1 Search Handoff ADR + early-return tests | 5 | Decision + lock tests; no prod path change |
| T2 Preview contracts (BrainRouter+) | 5 | Types/hooks; avoid L1 rewrite |
| T3 Memory adapters | 8 | Provenance + trip isolation; highest care |
| T4 Interfaces only | 5 | Types/docs; low runtime risk |
| T5 Golden evaluation skeleton | 8 | Harness + 5 goldens + CI |
| T6 Shadow telemetry skeleton | 5 | Schema + redaction + test dual-run |
| T7 Docs + verify + freeze gates | 3 | Packaging |
| **Total** | **~39** | Single focused engineer stream; T2∥T4 after T1 |

**Risk buffer:** +5–8 relative points if ADR debate reopens or golden prose assertions are over-tightened (prefer structural asserts).

---

## 11. Suggested file touch list (implementation phase — not now)

```text
docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md          (new)
docs/SPRINT88_PREVIEW_CONTRACTS.md              (new)
docs/SPRINT88_COMPLETION_REPORT.md              (end)
src/lib/brain/v1/preview/*                      (contract extensions only)
src/lib/brain/v1/preview/memory/* or adapters/* (new adapters)
src/lib/brain/v1/contracts/domainIntelligence.ts
src/lib/brain/v1/contracts/normalizedOffer.ts
src/lib/brain/v1/contracts/rankingConfig.ts
src/lib/brain/v1/eval/*                         (harness + goldens)
src/lib/__tests__/...                           (unit/integration/golden)
package.json                                    (optional verify script)
```

**Do not touch for Sprint 88 unless required for a failing freeze test:** UI routes, Voice, payments, booking orchestrator, `ProviderGateway` internals (read-only reference), production CSP, flag defaults.

---

## 12. Definition of Done checklist

- [ ] Plan approved; Task 1 authorized  
- [ ] ADR merged with Option A or B selected  
- [ ] Early-return tests green  
- [ ] Preview contracts extended; L1/L2 not rebuilt  
- [ ] Memory adapters + privacy/trip isolation tests green  
- [ ] DomainIntelligence / ranking / NormalizedOffer interfaces exported  
- [ ] Golden harness + G01–G05 green in CI  
- [ ] Shadow telemetry tests green; no PII/secrets  
- [ ] Freeze + typecheck + lint + build + relevant test:run green  
- [ ] Flags still OFF; no `ai.tie.v1`  
- [ ] Completion report written  
- [ ] Explicit confirmation: Search Handoff **not** implemented (deferred to Sprint 90)

---

## 13. Kickoff gate

**Do not implement Task 1 until explicit approval of this plan.**

After approval, implementation order starts at **Task 1** only.

---

*Sprint 88 Implementation Plan · Architecture approved · Flags OFF · No production code in this document · Awaiting authorization to begin Task 1.*
