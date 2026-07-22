# Alpha Readiness Report — Sprint 88

**Sprint:** 88 — Alpha Readiness Validation  
**Date:** 2026-07-22  
**Audited ref:** `main` @ `a71b6eb` (Sprint 87 Constitution)  
**Package:** `1.1.0-rc.1` · **Product:** `1.0.0` GA  
**Rules honored:** no new AI engines · no architecture redesign · no planning/decision engine changes · documentation + validation only  

**Method:** Library-level traveler simulation via `travelAgentService.planTurn` (default `/chat` path), existing Alpha QA suites (95 related tests green), static pipeline audit of `src/lib/agent/travelAgentService.ts` + `src/core/*`. Providers default **mock**. Live inventory / live payments **not** exercised (secrets absent; flags OFF by design).

---

## Executive verdict

# WARNING — CONDITIONAL ALPHA (MOCK MODE)

Rahhal can complete **mock-mode** traveler journeys from first message → plan → book → pay in automated Alpha QA. Strategy Planner, Search tools, Decision Engine, and Conversation Brain run on the live `/chat` path. **However**, several stages in the product pipeline are incomplete or advisory-only, and intent extraction introduces traveler-visible corruption on common mid-conversation edits.

**Not ready for live-provider Alpha** without Sprint 89+ work on extraction safety, Constitution enforcement, Package Builder offer-pool reliability, and Itinerary Refinement merge.

### Decision

| Gate | Result |
| --- | --- |
| Mock-mode Alpha pilot (internal) | **WARNING — proceed with known gaps** |
| Live inventory Alpha | **FAIL** |
| Constitution-governed Alpha | **FAIL** (library exists; not wired) |
| Production GA expansion | **FAIL** (unchanged freezes) |

---

## Scorecard (0–100)

| Category | Score | Verdict |
| --- | ---: | --- |
| Conversation | **78** | WARNING |
| Planning | **82** | PASS |
| Decision | **76** | WARNING |
| Learning | **68** | WARNING |
| Recovery | **54** | WARNING |
| Recommendation | **72** | WARNING |
| Overall User Experience | **70** | WARNING |
| **Overall Alpha Readiness** | **66** | **WARNING** |

Scoring blends: (1) empirical `planTurn` outcomes on 15 required journeys, (2) pipeline wiring audit, (3) existing Alpha/QA suites, (4) Constitution compliance (opt-in library only).

---

## Pipeline validation

### Product diagram (requested)

```
Conversation → Intent → Strategy Planner → Search → Price Intelligence
  → Package Builder → Itinerary Refinement → Decision Engine
  → Learning Engine → Rahhal Constitution → Final Recommendation
```

### Actual `/chat` order (`planTurn`)

```
Intent extraction + memory merge
  → Travel Strategy Planner          ✓ wired (ai.travel_planner)
  → Adaptive Learning (early)        ✓ wired (ai.adaptive_learning)
  → Search / autonomous tools        ✓ wired (mock default)
  → Budget / Personalization / Optimizer
  → Package Builder                  ⚠ wired but often no-ops (needs flight+hotel pools)
  → Decision Engine                  ✓ wired
  → Price Intelligence               ⚠ wired AFTER decision; intermittent on thin pools
  → Booking Intelligence → Execution → Payments (mock)
  → Conversation Brain (final text)  ✓ wired
```

| Stage | Wired on `/chat`? | Flag | Alpha result |
| --- | --- | --- | --- |
| Conversation Brain | Yes | (always) / `ai.rahhal_brain` | PASS |
| Intent Extraction | Yes | — | WARNING (corruption bugs) |
| Strategy Planner | Yes | `ai.travel_planner` | PASS |
| Search | Yes | `ai.autonomous_agent` + engines | PASS (mock) |
| Price Intelligence | Yes (post-decision) | `ai.price_intelligence` | WARNING |
| Package Builder | Yes | `ai.dynamic_packages` | WARNING (often null) |
| Itinerary Refinement (S84) | **No — not on main** | `ai.itinerary_refinement` (branch) | FAIL |
| Decision Engine | Yes | `ai.autonomous_decision` | PASS |
| Learning Engine | Yes (local) | `ai.adaptive_learning` | WARNING |
| Rahhal Constitution (S87) | **Library only** | `ai.constitution` | FAIL (not enforced) |
| Final Recommendation | Yes | — | PASS (narrative) |

---

## Journey results (15 required)

| # | Journey | Result | Key evidence |
| ---: | --- | --- | --- |
| 1 | Family SA → Paris · 15k SAR · children · hotels/activities/flights | **PASS** | `tripPurpose=family`, travelers=4, budget=15000, planner+decision ran; activities shallow in mock |
| 2 | Business Riyadh → London · flexible · fastest | **PASS** | `tripPurpose=business`, price intel present on this turn |
| 3 | Luxury honeymoon Maldives · villa | **PASS** | `tripPurpose=honeymoon`, budget=45000; luxury depth limited to labels/notes |
| 4 | Budget Turkey · lowest cost | **WARNING** | Clarified for travelers instead of committing lowest-cost package; decision/packages missing |
| 5 | Change destination mid-chat | **WARNING** | Destination becomes Rome but **Paris retained** in `destinations` list |
| 6 | Double budget | **PASS** | Budget updated 6000 → 12000 |
| 7 | Reduce budget below feasibility | **FAIL*** | Budget becomes 1500; destination corrupted to **"Only"** (`only 1500 SAR`) |
| 8 | Reject recommendation | **WARNING** | Continues with Dubai plan; no Constitution-grade recovery alternatives |
| 9 | Change hotel class | **WARNING** | Plan regenerates; hotel-class constraint weakly evidenced in reply |
| 10 | Impossible itinerary | **WARNING** | Clarifies slots; does not clearly explain constraints vs closest achievable |
| 11 | Flight unavailable | **WARNING** | Regenerates plan; no explicit airline/airport recovery checklist |
| 12 | Hotel unavailable | **WARNING** | Follow-up often drops planner/decision; asks for dates again |
| 13 | Change travel dates | **FAIL*** | Destination corrupted to **"April Instead"** |
| 14 | Change traveler count | **PASS** | Travelers 2 → 4 |
| 15 | Interrupt then resume | **PASS** | Morocco context retained across stop/resume turns |

\*FAIL = traveler-visible correctness bug on the edit path (intent extraction), not a crashed process. Process still returned a reply.

**Automated suite corroboration:** `alphaQa.scenarios`, `rahhalAlpha.journey`, `alpha-morocco-journey`, planner/package/constitution unit suites — **95/95 passed** in this validation run.

---

## Dimension evaluation (across journeys)

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Conversation Quality | WARNING | Deterministic / template narrative; workable Arabic/English; not generative ChatGPT-class |
| Intent Understanding | WARNING | Strong on first-shot slots; **unsafe** on “only / instead / April” style edits |
| Question Quality | PASS | Clarifying questions fire when slots missing |
| Strategy Quality | PASS | Purpose-aware planner meta present |
| Search Quality | WARNING | Mock inventory success ≠ live availability |
| Price Intelligence | WARNING | Synthetic history; order after DE; often absent when pools thin |
| Package Quality | WARNING | Requires both flight+hotel offers; frequently skipped |
| Recommendation Quality | WARNING | Trip plan + booking-ready often true under mock; explanations uneven |
| Explanation Quality | WARNING | Narrative summary; structured why/benefits/tradeoffs/confidence not Constitution-gated |
| Alternative Quality | WARNING | Alternatives exist in engines; rejection path weak |
| Recovery Quality | WARNING | Tool retries exist; Constitution recovery checklist unused |
| Constitution Compliance | FAIL | `validatePrinciples` not called from `planTurn` |
| Learning Behaviour | WARNING | Local PreferenceStore; no durable cross-device profile |
| Mission Alignment | WARNING | Purpose inferred (family/business/honeymoon); mission-before-destination not enforced |

---

## Category PASS / WARNING / FAIL

| Category | Result |
| --- | --- |
| Conversation | WARNING |
| Planning | PASS |
| Decision | WARNING |
| Learning | WARNING |
| Recovery | WARNING |
| Recommendation | WARNING |
| Overall User Experience | WARNING |
| Overall Alpha Readiness | **WARNING** |
| Live providers | FAIL |
| Payments (live) | FAIL (frozen mock — intentional) |
| Constitution runtime | FAIL |
| Itinerary Refinement on main | FAIL |

---

## Highest-risk scenarios

1. Mid-conversation date/budget phrasing that steals destination tokens (“only”, “instead”, month names).
2. Traveler rejects plan and expects ranked alternatives — recovery is soft regenerate, not Constitution-grade.
3. Live provider Alpha with empty real inventory — Constitution “never end with no results” not enforced.
4. Thin offer pools → Package Builder + Price Intel silently skip → Decision on incomplete inputs.
5. Resume-after-interrupt across devices (memory is conversation/message rebuild, not durable profile DB).

---

## Missing edge cases (not fully covered)

- Same-day multi-city with visa impossibility
- Child-age hotel policy failures
- Currency mismatch mid-trip
- Partial payment capture + refund chat path
- Voice PTT interrupt during tool execution
- Concurrent edit of destination **and** budget in one utterance
- Explicit “mission only, no destination” cold start through packages
- Live Amadeus/Booking timeout storm on `/chat`

---

## Production blockers (Alpha → broader release)

| Blocker | Severity | Sprint |
| --- | --- | --- |
| Intent extraction destination corruption on edits | **P0** | 89 |
| Constitution not runtime-wired | P0 (governance) | 89 |
| Package Builder skip when pools incomplete | P1 | 89 |
| Itinerary Refinement not on main | P1 | 84 merge / 89 |
| Live providers + secrets not validated | P0 for live Alpha | Ops + 89 |
| Payments frozen mock | Accepted freeze | Post-Alpha |
| Price Intel after Decision (diagram mismatch) | P2 | 89+ |

**No critical process-crashing bugs** were found that block completing this validation sprint. **No hotfixes** were applied (none required to finish documentation validation).

---

## Evidence index

| Artifact | Role |
| --- | --- |
| `docs/USER_JOURNEYS.md` | Journey narratives + expected vs actual |
| `docs/TEST_SCENARIOS.md` | Scenario matrix + how to re-run |
| `docs/WEAKNESSES.md` | Top weaknesses |
| `docs/TOP20_ALPHA_IMPROVEMENTS.md` | Pre-Alpha improvement backlog |
| `docs/RAHHAL_AI_CONSTITUTION.md` | Governance spec (S87) |
| `src/lib/__tests__/alphaQa.scenarios.test.ts` | Family/business/honeymoon/budget plan→book→pay |
| `npm run constitution:verify` | Constitution module verify |

---

## Recommendation

1. **Internal mock Alpha:** allowed with WARNING banner (known extraction + package + constitution gaps).  
2. **External traveler Alpha:** defer until Sprint 89 closes P0 extraction + Constitution wiring.  
3. **Live inventory Alpha:** defer until providers validated with secrets and empty-result recovery proven.
