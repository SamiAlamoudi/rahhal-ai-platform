# ADR — Sprint 88 Search Handoff

**Status:** Accepted (Sprint 88 Task 1)  
**Date:** 2026-08-01  
**Baseline:** Architecture ADD `docs/ARCHITECTURE_TRAVEL_INTELLIGENCE_ENGINE_SPRINT88-95.md` §2.5  
**Flags:** `ai.brain.v1` OFF (frozen); `ai.brain.v1.preview` OFF (default; prod hard-blocked)  
**Related:** Preview Orchestrator (BrainRouter+); `travelAgentService.planTurn` sole turn owner  

---

## 1. Context

Today, when `ai.brain.v1.preview` is ON (non-prod) and Brain succeeds, `planTurn` **early-returns** with `toolBatch: null` and never enters the Current Planner tool/search path or `src/core/providerGateway`.

Sprint 90 will reconnect search. This ADR decides **how**, and locks **safety gates** that apply before any search or gateway call—including after handoff is implemented.

---

## 2. Decision

### 2.1 Handoff option: **Option A — Soft-enrich then continue**

| Option | Summary | Decision |
| --- | --- | --- |
| **A — Soft-enrich then continue** | Preview upgrades memory/session/XAI, then **does not early-return**; `planTurn` continues into the **existing** tool/search pipeline and `src/core/providerGateway` | **Accepted** for Sprint 90 implementation |
| **B — Deferred search stage** | Keep early-return for Exploring/Refining; only Searching stage returns a structured search intent | Rejected for now (higher contract surface; revisit only if Option A proves unsafe) |

**Rationale:** Best reuse of the Current Planner search path; avoids a parallel search owner; aligns with Recovery freeze (`planTurn` remains sole turn owner).

### 2.2 Current behavior (Sprint 88 lock)

Until Sprint 90 implements Option A:

- Successful preview turns **early-return** with `toolBatch: null`.
- No provider search and no Provider Gateway invocation on the Brain success path.
- Tests in `src/lib/__tests__/sprint88.searchHandoff.task1.test.ts` lock this behavior.

---

## 3. Hard gate — clarification before Search / Provider Gateway

> **Normative (applies today and after Sprint 90 handoff):**

**If the conversation does not yet contain sufficient information to run a meaningful search, the planner MUST ask a clarification question first and MUST NOT invoke Search or any Provider Gateway.**

### 3.1 Rules

| Rule | Requirement |
| --- | --- |
| Insufficient information | Do **not** call Search, tool search batches, or `src/core/providerGateway` |
| Clarification first | Ask a clarification question (question budget ≤ 1 by default; 0 when enough is known) |
| Sufficient information | Only then may Option A continue into the existing search pipeline / gateway |
| Never fabricate | No invented live inventory while clarifying |
| Conversation-first | Value-first preliminary content may still be shown **without** search when clarifying |
| Booking-only fields | Passport, traveler identity, payment consent are **not** required for search sufficiency; defer to booking stage |

### 3.2 “Sufficient information” (minimum for search eligibility)

Search/gateway may be considered only when **blocking search fields** for the intended domain query are known or safely assumed under AssumptionEngine rules—for example, for a typical flight search: origin, destination, and usable dates (or explicit flexible-dates intent with enough constraint to query). Exact field sets remain owned by ClarificationPolicy / ToolMissingFields and domain query builders (Sprint 90+).

**If any genuinely blocking search field is missing → clarify; do not search.**

### 3.3 Sequence (post–Sprint 90 Option A)

```text
planTurn
  → Preview Orchestrator (BrainRouter+) / ConversationManager
       → extract + memory adapters
       → IF insufficient information
            → value-first (optional) + ≤1 clarification
            → MUST NOT invoke Search
            → MUST NOT invoke Provider Gateway
            → return consultant reply (no toolBatch search)
       → ELSE (sufficient information)
            → soft-enrich memory/session/XAI
            → continue existing planTurn search / tools
            → DomainIntelligence → src/core/providerGateway only
```

### 3.4 Non-negotiable constraints

1. Reuse existing search pipeline inside `planTurn` — no second search owner.  
2. Domain modules call **`src/core/providerGateway` only** — no parallel provider bus.  
3. No `ai.tie.v1`; sole soft pilot remains `ai.brain.v1.preview`.  
4. Production hard-block and default-OFF unchanged.  
5. Prevent infinite tool loops, duplicated tool calls, and repeated questions.

---

## 4. Sprint boundaries

| Sprint | Work |
| --- | --- |
| **88 (this ADR)** | Document decision + clarification gate; lock early-return tests; **no handoff implementation** |
| **90** | Implement Option A soft-enrich continue **only when sufficient information**; enforce clarification gate in code |
| **91+** | Gateway merge/failover extensions on existing gateway |

---

## 5. Consequences

- Sprint 88 product behavior with flags OFF: unchanged.  
- Sprint 88 with preview ON in tests: still early-returns; `toolBatch: null`; no gateway.  
- Sprint 90 must fail closed: missing info → clarify path, zero search/gateway calls.  
- Option B remains archived unless Option A is explicitly reopened.

---

## 6. Confirmation checklist (Task 1)

- [x] Option A accepted for future handoff  
- [x] Early-return documented as current truth  
- [x] **Clarification-before-search/gateway gate documented as normative**  
- [x] Existing search pipeline + `src/core/providerGateway` reuse mandated  
- [x] No Sprint 90 implementation in Task 1  

---

*ADR-SPRINT88-SEARCH-HANDOFF · Task 1 · Flags OFF · Awaiting Tasks 2+ after review*
