# Rahhal AI Contracts v1

**Document type:** Model-agnostic interface specification  
**Status:** Design only — implementation-ready contracts; **no code in this document**  
**Baseline:** `main` with Sprint 88 complete  
**Governing constitution:** `docs/BRAIN_SPECIFICATION_v1.md`  
**Supporting references:**  
- `docs/ARCHITECTURE_SPRINT89_AI_FIRST_REVISION.md`  
- `docs/ARCHITECTURE_TRAVEL_INTELLIGENCE_ENGINE_SPRINT88-95.md`  
- `docs/SPRINT88_PREVIEW_CONTRACTS.md`  
- `docs/SPRINT88_MEMORY_ADAPTERS.md`  
- `docs/SPRINT88_GOLDEN_EVALUATIONS.md`  
- `docs/SPRINT88_SHADOW_TELEMETRY.md`  
- `docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md`  

**Non-goals of this document:** production code, runtime wiring, feature-flag enablement, commits, branches, PRs, tags, booking/payment execution, STT/TTS provider design.

---

## 0. Purpose

Define **stable, model-agnostic contracts** between Rahhal AI components so that GPT, Claude, Gemini, local models, deterministic engines, or future providers can be exchanged **without changing the rest of the application**.

Contracts describe **what** components exchange and guarantee.  
They do **not** prescribe a model vendor, prompt text, or runtime implementation.

Implementations MUST conform to these contracts.  
This document does **not** authorize shipping, enabling flags, or changing production behavior.

---

## 1. Mandatory architectural rules

| # | Rule |
| --- | --- |
| 1 | `travelAgentService.planTurn` remains the **sole turn owner** (`RECOVERY_TURN_OWNER`). |
| 2 | `ai.brain.v1` remains **OFF**. |
| 3 | `ai.brain.v1.preview` remains **OFF by default** and **production hard-blocked**. |
| 4 | **No** `ai.tie.v1` contract, flag, or parallel fabric. |
| 5 | **No** Search or Provider Gateway execution unless sufficient information exists. |
| 6 | **Clarify-before-search** is mandatory (ADR-SPRINT88-SEARCH-HANDOFF §3). |
| 7 | **Search Handoff** is a **decision contract only** unless separately approved later. |
| 8 | Existing `src/core/providerGateway` MUST be reused; **no parallel provider fabric**. |
| 9 | Booking and payment execution remain **out of scope**. |
| 10 | Voice and text MUST use the **same** planning and reasoning contracts. |
| 11 | STT/TTS providers remain **outside** Brain contracts (channel adapters only). |
| 12 | Memory MUST distinguish: user-provided, inferred, assumptions, provider results, stale, corrected. |
| 13 | Every inferred or assumed value MUST include **provenance** and **confidence**. |
| 14 | The system MUST **never silently convert** an assumption into a confirmed fact. |
| 15 | Memory MUST support correction, invalidation, expiry, deletion, and user isolation. |
| 16 | Tool calls MUST be auditable and MUST NOT expose secrets or hidden reasoning. |
| 17 | Explainability MUST provide concise **user-safe** reasons — not private chain-of-thought. |
| 18 | Domain contracts MUST return normalized, comparable, explainable results. |
| 19 | **No geography-specific hardcoded ranking rules** in shared contracts. |
| 20 | Visa remains **guidance-only** and post-core for product execution. |
| 21 | Payment gateways (Tap, Tamara, etc.) remain **future boundaries only**. |
| 22 | **Production behavior must remain unchanged** while these contracts are documentation-only. |

---

## 2. Shared envelope

Every AI contract request and response wraps a **ContractEnvelope**. Domain-specific payloads nest under `payload`.

### 2.1 Envelope fields

| Field | Required | Description |
| --- | --- | --- |
| `contractVersion` | yes | Semver-like contract id, e.g. `ai-contracts-v1.0.0` or per-contract `intent-extractor@1.0.0` |
| `requestId` | yes | Unique id for this contract invocation |
| `conversationId` | yes | Stable conversation identifier |
| `turnId` | yes | Identifier for the `planTurn` turn |
| `userIdHash` | yes | Privacy-safe hashed user id (never raw PII) |
| `locale` | yes | BCP-47 locale (e.g. `ar`, `ar-SA`, `en`) |
| `timestamp` | yes | ISO-8601 UTC |
| `source` | yes | Origin channel: `text` \| `voice_transcript` \| `system` \| `eval` \| `shadow` |
| `confidence` | response | Aggregate confidence object (§3) |
| `assumptions` | response | List of active assumptions with provenance |
| `provenance` | response | Evidence and source attribution summary |
| `warnings` | response | Non-fatal issues (stale data, partial ranks, etc.) |
| `errors` | response | Structured errors from shared taxonomy (§4) |
| `latencyMs` | response | Observed latency for this contract call |
| `traceId` | yes | Distributed / shadow trace id |
| `privacyClassification` | yes | `public` \| `internal` \| `sensitive_redacted` \| `forbidden_in_telemetry` |

### 2.2 Envelope invariants

- `source: voice_transcript` MUST enter the **same** Brain contracts as `text` after STT (STT itself is out of contract scope).
- Envelope MUST NOT contain raw passport numbers, payment tokens, secrets, provider credentials, or private chain-of-thought.
- `userIdHash` is one-way; reverse lookup MUST NOT appear in contract payloads.
- Assumptions in the envelope are **never** auto-promoted to confirmed facts.

### 2.3 Envelope sketch (illustrative, not code)

```json
{
  "contractVersion": "ai-contracts-v1.0.0",
  "requestId": "req_01JEXAMPLE",
  "conversationId": "conv_01JEXAMPLE",
  "turnId": "turn_001",
  "userIdHash": "uh_9f3c…",
  "locale": "ar",
  "timestamp": "2026-08-01T20:00:00.000Z",
  "source": "text",
  "traceId": "tr_01JEXAMPLE",
  "privacyClassification": "internal",
  "confidence": { "level": "medium_confidence_inferred", "score": 0.72 },
  "assumptions": [],
  "provenance": { "sources": ["user_utterance"], "evidenceIds": ["ev_1"] },
  "warnings": [],
  "errors": [],
  "latencyMs": 42,
  "payload": {}
}
```

---

## 3. Common confidence model

| Level | Code | Meaning | May drive search? | May present as fact? |
| --- | --- | --- | --- | --- |
| Confirmed | `confirmed` | Explicitly stated or user-confirmed | yes (if otherwise sufficient) | yes |
| High-confidence inferred | `high_confidence_inferred` | Strong evidence; reversible | yes if AssumptionEngine allows | only with soft wording |
| Medium-confidence inferred | `medium_confidence_inferred` | Plausible; prefer clarify if blocking | usually no if blocking | soft only |
| Assumption | `assumption` | Safe reversible default | only if reversible + non-blocking or explicitly allowed | never as confirmed |
| Unknown | `unknown` | Missing | no if field is blocking | no |
| Conflicting | `conflicting` | Contradictory evidence | no until resolved | no |
| Stale | `stale` | Previously known; past freshness window | no for live inventory claims | only with staleness caveat |

**Promotion rule:** Only an explicit traveler confirmation (or equivalent MemoryCorrection with `confirmed`) may move a value to `confirmed`. Engines MUST NOT silently promote.

**Score (optional):** `0.0–1.0` numeric companion; level is normative when score and level disagree.

---

## 4. Shared error taxonomy

| Code | When |
| --- | --- |
| `VALIDATION_ERROR` | Payload fails schema / required fields |
| `INSUFFICIENT_INFORMATION` | Blocking fields missing for next step (esp. search) |
| `AMBIGUOUS_REFERENCE` | “there”, “نفس الفندق”, unresolved entity |
| `CONFLICTING_INFORMATION` | Contradictory facts across utterance/memory |
| `UNSUPPORTED_REQUEST` | Outside product capability |
| `SAFETY_BLOCK` | SafetyPolicy refusal |
| `PRIVACY_BLOCK` | Privacy / redaction policy refusal |
| `TIMEOUT` | Soft/hard timeout exceeded |
| `CANCELLED` | Turn/request cancelled |
| `PROVIDER_UNAVAILABLE` | Gateway/provider down (future execute path) |
| `TOOL_FAILURE` | Tool invocation failed after eligibility |
| `STALE_DATA` | Required data past freshness |
| `INTERNAL_CONTRACT_VIOLATION` | Invariant broken between contracts |
| `FALLBACK_USED` | Safe fallback path engaged (may be warning-level) |

Error object shape (conceptual):

| Field | Required | Notes |
| --- | --- | --- |
| `code` | yes | From taxonomy |
| `message` | yes | Internal sanitized message (not user-facing by default) |
| `userSafeSummary` | optional | Consultant-safe phrase if surfaced |
| `fields` | optional | Related field paths |
| `retryable` | yes | boolean |
| `details` | optional | Redacted structured details — never secrets |

---

## 5. Shared provenance & memory fact model

### 5.1 Fact kinds

| Kind | Code |
| --- | --- |
| User-provided | `user_provided` |
| Inferred | `inferred` |
| Assumption | `assumption` |
| Provider result | `provider_result` |
| Stale value | `stale` |
| Corrected value | `corrected` |

### 5.2 Provenance record (conceptual)

| Field | Required | Description |
| --- | --- | --- |
| `factId` | yes | Stable id |
| `field` | yes | e.g. `trip.destination` |
| `value` | yes | Structured or string value |
| `kind` | yes | Fact kind above |
| `confidence` | yes | Confidence level |
| `sourceTurnId` | optional | Originating turn |
| `evidenceRefs` | optional | Utterance/spans/offer ids |
| `assumedBy` | optional | Contract that created assumption |
| `expiresAt` | optional | Expiry |
| `invalidatedAt` | optional | Soft-delete / invalidation |
| `supersedesFactId` | optional | Correction chain |
| `userIsolated` | yes | Must be true for user-scoped facts |

**Invariant:** Writing `kind: assumption` with `confidence: confirmed` is an `INTERNAL_CONTRACT_VIOLATION`.

---

## 6. Contract dependency diagram

```text
ConversationInput
        │
        ▼
ConversationState ◄──────────────────────────── MemoryReader
        │                                              ▲
        ▼                                              │
IntentExtractor ──► EntityExtractor ──► ReferenceResolver
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
            MissingInformationPlanner
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
 AssumptionEngine  ConfidenceEngine  ClarificationPolicy
          │            │            │
          └────────────┼────────────┘
                       ▼
              ValueFirstPlanner
                       │
                       ▼
             ConversationPlanner
                       │
                       ▼
                TravelReasoner ◄── DestinationKnowledge
                       │
                       ▼
              ToolDecisionEngine
                       │
                       ▼
            SearchHandoffDecision
                       │
        (only if sufficient + approved execute path)
                       ▼
              DomainIntelligence
        ┌──────┬───────┼───────┬──────────┐
        ▼      ▼       ▼       ▼          ▼
     Flight  Hotel  Activity  Car   VisaGuidance*
        │      │       │       │          │
        └──────┴───┬───┴───────┘          │
                   ▼                      │
            OfferNormalizer               │
                   ▼                      │
              OfferRanker                 │
                   ▼                      │
           BudgetAndPricingIntelligence   │
                   ▼                      │
            ItineraryBuilder              │
                   ▼                      │
           ResponseGenerator ◄────────────┘
                   │
                   ▼
          ExplainabilityResult
                   │
                   ▼
     MemoryWriter / MemoryCorrection / Preference / Trip / LongTerm
                   │
                   ▼
             BrainTurnResult
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
  ShadowTelemetryEvent   GoldenEvaluationCase (eval)

Cross-cutting gates: SafetyPolicy, FailureRecovery
```

* VisaGuidanceIntelligence is **guidance-only**; not a booking/search sufficiency domain.

**Cross-cutting:** SafetyPolicy, FailureRecovery, ConfidenceEngine, ShadowTelemetryEvent.

**Turn owner:** All of the above execute under `planTurn` orchestration. No contract may become a second turn owner.

---

## 7. Contract template (applies to every contract below)

For each contract A–AL, the following twenty-one aspects are defined. Where a contract inherits the shared envelope defaults, the section states “per envelope” rather than repeating every field.

1. Responsibility  
2. Inputs  
3. Required and optional fields  
4. Outputs  
5. Confidence representation  
6. Assumptions and provenance  
7. Validation rules  
8. Invariants and guarantees  
9. Failure modes  
10. Error taxonomy (applicable codes)  
11. Timeout and cancellation  
12. Fallback behavior  
13. Privacy and redaction  
14. Observability and telemetry fields  
15. Idempotency  
16. Versioning and compatibility  
17. Example request  
18. Example successful response  
19. Example partial-confidence response  
20. Example failure response  
21. Acceptance criteria  

---

## 8. Contracts

> **Notation:** Examples are illustrative JSON sketches for implementers. They are **not** runtime code and MUST NOT be pasted as production modules without schema review.

---

### A. ConversationInput

1. **Responsibility:** Canonical traveler utterance entering `planTurn` after channel adapters (text UI or STT transcript).  
2. **Inputs:** Envelope + utterance payload.  
3. **Required / optional:**  
   - Required: `text`, `channel` (`text` \| `voice`), `locale`, ids in envelope.  
   - Optional: `asrConfidence`, `clientMessageId`, `attachmentsMeta` (non-PII), `replyToTurnId`.  
4. **Outputs:** Normalized ConversationInput accepted by Intent/Entity extractors.  
5. **Confidence:** Optional `asrConfidence` for voice; does not equal entity confidence.  
6. **Assumptions / provenance:** `source` distinguishes voice vs text; no assumptions created here.  
7. **Validation:** Non-empty text after trim (unless explicit cancel signal); locale present; no secrets expected.  
8. **Invariants:** Voice and text share identical downstream contracts; STT/TTS not invoked here.  
9. **Failure modes:** Empty transcript; oversized payload; unsupported channel.  
10. **Errors:** `VALIDATION_ERROR`, `PRIVACY_BLOCK`.  
11. **Timeout / cancel:** N/A (ingress); cancelled turn → `CANCELLED` upstream.  
12. **Fallback:** Ask traveler to resend (consultant language via ResponseGenerator later).  
13. **Privacy:** Redact payment/passport patterns if accidentally present before telemetry.  
14. **Telemetry:** `source`, `textLength`, `asrConfidenceBucket` — never raw text in shadow telemetry.  
15. **Idempotency:** Same `clientMessageId` + `turnId` SHOULD dedupe.  
16. **Versioning:** `conversation-input@1.x`; additive optional fields OK.  
17. **Example request:**

```json
{
  "contractVersion": "conversation-input@1.0.0",
  "requestId": "req_ci_1",
  "conversationId": "conv_m",
  "turnId": "turn_1",
  "userIdHash": "uh_x",
  "locale": "ar",
  "timestamp": "2026-08-01T20:00:00.000Z",
  "source": "text",
  "traceId": "tr_m",
  "privacyClassification": "internal",
  "payload": { "text": "أريد رحلة إلى المغرب", "channel": "text" }
}
```

18. **Success:** Echo-accepted input with normalized Unicode and `textLength`.  
19. **Partial:** Voice with `asrConfidence: 0.55` → proceed with warning `low_asr_confidence`.  
20. **Failure:** `{ "errors": [{ "code": "VALIDATION_ERROR", "message": "empty_text", "retryable": true }] }`  
21. **Acceptance:** Voice transcript and typed text produce envelopes that differ only in `source`/`channel`/`asr*` fields.

---

### B. ConversationState

1. **Responsibility:** Durable-in-session view of Brain cognitive posture and trip draft pointers (internal).  
2. **Inputs:** Prior state + latest understanding deltas.  
3. **Required / optional:** Required: `brainState` (Brain Spec §3), `stage` (preview stage optional), `activeTripId`, `pendingClarification`. Optional: `lastSearchDecision`, `valueFirstShown`.  
4. **Outputs:** Updated ConversationState for the turn.  
5. **Confidence:** Per-slot confidence map optional.  
6. **Assumptions / provenance:** Tracks which slots are assumed vs confirmed.  
7. **Validation:** `brainState` ∈ Idle…Recovery set; never user-visible.  
8. **Invariants:** State names never leak to ResponseGenerator user text; sole turn owner remains `planTurn`.  
9. **Failure modes:** Corrupt state blob; version mismatch.  
10. **Errors:** `VALIDATION_ERROR`, `INTERNAL_CONTRACT_VIOLATION`, `STALE_DATA`.  
11. **Timeout:** Soft 50ms local; hard fail → rebuild from MemoryReader.  
12. **Fallback:** Reconstruct minimal state from MemoryReader + Idle/Listening.  
13. **Privacy:** No raw utterances stored beyond retention policy; hash refs preferred in telemetry.  
14. **Telemetry:** `brainState`, `hasPendingClarification`, `turnIndex`.  
15. **Idempotency:** Applying same delta twice MUST be safe.  
16. **Versioning:** `conversation-state@1.x`.  
17. **Request sketch:** `{ "priorState": { "brainState": "Listening" }, "delta": { "utteranceTurnId": "turn_1" } }`  
18. **Success:** `{ "brainState": "Understanding", "pendingClarification": null }`  
19. **Partial:** State loaded with `warnings: ["preference_memory_unavailable"]`.  
20. **Failure:** `{ "errors": [{ "code": "INTERNAL_CONTRACT_VIOLATION", "message": "unknown_brain_state" }] }`  
21. **Acceptance:** State transitions obey Brain Spec hierarchy; no search flags set while clarifying.

---

### C. IntentExtractor

1. **Responsibility:** Classify traveler intent for the turn (plan, refine, compare, advise, correct, abort, small_talk, etc.).  
2. **Inputs:** ConversationInput + ConversationState summary + MemoryReader snapshot.  
3. **Required / optional:** Required: `text`. Optional: prior intent, short history window.  
4. **Outputs:** `primaryIntent`, `secondaryIntents[]`, `isCorrection`, `isConfirmation`.  
5. **Confidence:** Per-intent confidence level + score.  
6. **Assumptions / provenance:** Evidence spans; no trip facts written.  
7. **Validation:** Intent ∈ published enum; correction flag consistent with MemoryCorrection path.  
8. **Invariants:** Model-agnostic; no tool calls; no workflow exposure in labels to user.  
9. **Failure modes:** Empty text; model timeout; unsupported language mix.  
10. **Errors:** `VALIDATION_ERROR`, `TIMEOUT`, `UNSUPPORTED_REQUEST`, `FALLBACK_USED`.  
11. **Timeout:** Soft 800ms / hard 2000ms (guidance).  
12. **Fallback:** Deterministic keyword/heuristic intent; mark `FALLBACK_USED`.  
13. **Privacy:** Utterance not logged raw in shadow telemetry.  
14. **Telemetry:** `primaryIntent`, `confidence.level`, `fallback`.  
15. **Idempotency:** Pure function of inputs + model version pin.  
16. **Versioning:** `intent-extractor@1.x`; new intents additive.  
17. **Request:** ConversationInput for «أريد رحلة إلى المغرب».  
18. **Success:** `{ "primaryIntent": "plan_trip", "confidence": { "level": "high_confidence_inferred", "score": 0.9 } }`  
19. **Partial:** `{ "primaryIntent": "plan_trip", "confidence": { "level": "medium_confidence_inferred", "score": 0.6 } }`  
20. **Failure:** `{ "errors": [{ "code": "TIMEOUT", "retryable": true }] }`  
21. **Acceptance:** Correction utterances set `isCorrection: true`; booking-form intents are not required.

---

### D. EntityExtractor

1. **Responsibility:** Extract travel entities (destination, origin, dates, duration, party, budget, constraints, preferences).  
2. **Inputs:** ConversationInput + Intent + Memory snapshot.  
3. **Required / optional:** Required: text + intent. Optional: locale calendar hints.  
4. **Outputs:** `entities[]` with field, value, confidence, kind (`user_provided`/`inferred`).  
5. **Confidence:** Per entity.  
6. **Assumptions / provenance:** Must NOT emit `assumption` (that is AssumptionEngine). Provenance spans required for inferred.  
7. **Validation:** Dates ISO or structured flexible window; party ≥ 1 when present.  
8. **Invariants:** Never invent live prices; never mark assumed as user_provided.  
9. **Failure modes:** Ambiguous geo; unparseable date.  
10. **Errors:** `AMBIGUOUS_REFERENCE`, `VALIDATION_ERROR`, `CONFLICTING_INFORMATION`, `TIMEOUT`.  
11. **Timeout:** Soft 800ms / hard 2000ms.  
12. **Fallback:** Extract only high-precision entities; leave rest unknown.  
13. **Privacy:** Redact identity documents if present.  
14. **Telemetry:** entity field names + confidence levels only.  
15. **Idempotency:** Same inputs → same entities under pinned version.  
16. **Versioning:** `entity-extractor@1.x`.  
17. **Request:** text «أريد رحلة إلى المغرب».  
18. **Success:** `entities: [{ "field": "trip.destination", "value": "Morocco", "confidence": { "level": "confirmed" }, "kind": "user_provided" }]`.  
19. **Partial:** Destination inferred from nickname with `medium_confidence_inferred`.  
20. **Failure:** `{ "errors": [{ "code": "AMBIGUOUS_REFERENCE", "fields": ["trip.destination"] }] }`  
21. **Acceptance:** User-provided vs inferred correctly labeled; no silent assumptions.

---

### E. ReferenceResolver

1. **Responsibility:** Resolve anaphora and relative references (“هناك”, “نفس اليوم”, “الفندق الأول”).  
2. **Inputs:** Entities + ConversationState + ranked offers / itinerary pointers + memory.  
3. **Required / optional:** Required: candidate references. Optional: last shortlist ids.  
4. **Outputs:** Resolved bindings or ambiguity report.  
5. **Confidence:** Per binding.  
6. **Assumptions / provenance:** May propose inferred binding with evidence; not confirmed.  
7. **Validation:** Target ids must exist in context when claimed resolved.  
8. **Invariants:** Unresolved blocking refs → clarify path, not search.  
9. **Failure modes:** Multiple equally likely targets.  
10. **Errors:** `AMBIGUOUS_REFERENCE`, `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** Soft 300ms / hard 1000ms.  
12. **Fallback:** Return ambiguity → MissingInformationPlanner.  
13. **Privacy:** Offer ids opaque; no provider payloads.  
14. **Telemetry:** `resolvedCount`, `ambiguousCount`.  
15. **Idempotency:** Yes, pure over context snapshot.  
16. **Versioning:** `reference-resolver@1.x`.  
17. **Request:** «خلينا نروح هناك» with prior destination Morocco.  
18. **Success:** binds “هناك” → Morocco `confirmed` if prior confirmed.  
19. **Partial:** binds with `medium_confidence_inferred` + warning.  
20. **Failure:** `{ "errors": [{ "code": "AMBIGUOUS_REFERENCE" }] }`  
21. **Acceptance:** Never invent a destination not in memory/context.

---

### F. MissingInformationPlanner

1. **Responsibility:** Determine which fields are missing/blocking for the intended next hierarchy step.  
2. **Inputs:** Intent, entities, memory, ToolDecision preliminary goal.  
3. **Required / optional:** Required: `goal` (`advise` \| `search` \| `compare` \| …). Optional: domain hints.  
4. **Outputs:** `missing[]`, `blocking[]`, `deferrable[]`, `bookingOnly[]` (always defer passport/payment).  
5. **Confidence:** Confidence that a field is truly missing.  
6. **Assumptions / provenance:** Reads assumptions; does not create them.  
7. **Validation:** Booking-only fields MUST NOT be blocking for search.  
8. **Invariants:** Aligns with clarify-before-search; max question budget consumed later by ClarificationPolicy.  
9. **Failure modes:** Unknown goal.  
10. **Errors:** `VALIDATION_ERROR`, `INSUFFICIENT_INFORMATION` (signal, not always hard fail).  
11. **Timeout:** Soft 100ms / hard 500ms.  
12. **Fallback:** Conservative: treat uncertain blocking fields as missing.  
13. **Privacy:** Field names only in telemetry.  
14. **Telemetry:** `blockingFields`, `deferrableCount`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `missing-information-planner@1.x`.  
17. **Request:** goal `search`, memory has destination Morocco only.  
18. **Success:** `blocking: ["trip.origin", "trip.dates"]`, `bookingOnly: ["passport"]`.  
19. **Partial:** dates flexible unknown → blocking with medium confidence.  
20. **Failure:** `{ "errors": [{ "code": "VALIDATION_ERROR", "message": "unknown_goal" }] }`  
21. **Acceptance:** Passport/payment never appear in search `blocking[]`.

---

### G. ClarificationPolicy

1. **Responsibility:** Decide whether to ask, what to ask, and how to merge gaps into ≤1 question.  
2. **Inputs:** MissingInformationPlanner result + ConversationState + Brain Spec clarification rules.  
3. **Required / optional:** Required: `blocking`, `questionBudget` (default 1). Optional: prior questions asked.  
4. **Outputs:** `shouldAsk`, `question` (consultant text sketch or structured ask), `mergedFields[]`, `avoidReasons[]`.  
5. **Confidence:** Confidence that asking is necessary.  
6. **Assumptions / provenance:** Prefer not asking when AssumptionEngine can safely cover.  
7. **Validation:** ≤1 question per reply; no repeated identical question.  
8. **Invariants:** Never expose workflow; never multi-checklist interrogation as default.  
9. **Failure modes:** Empty blocking but shouldAsk true (violation).  
10. **Errors:** `INTERNAL_CONTRACT_VIOLATION`, `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Single generic open ask on destination/dates only if still blocking.  
13. **Privacy:** Question text may be user-facing later; no PII prompts.  
14. **Telemetry:** `shouldAsk`, `mergedFields`, `questionBudget`.  
15. **Idempotency:** Yes for same missing set + history.  
16. **Versioning:** `clarification-policy@1.x`.  
17. **Request:** blocking origin+dates for Morocco trip.  
18. **Success:** one merged question about departure city and approximate period.  
19. **Partial:** shouldAsk true but low confidence phrasing alternatives listed internally.  
20. **Failure:** attempt to emit 3 questions → `INTERNAL_CONTRACT_VIOLATION`.  
21. **Acceptance:** Caps at 1; merges multiple gaps; skips ask when zero questions enough.

---

### H. AssumptionEngine

1. **Responsibility:** Propose **reversible** safe defaults with provenance; never confirm them.  
2. **Inputs:** Missing fields + preferences + locale norms (non-geo ranking).  
3. **Required / optional:** Required: candidate fields. Optional: traveler tolerance profile.  
4. **Outputs:** `assumptions[]` with value, reversible=true, confidence=`assumption`.  
5. **Confidence:** Always `assumption` or refuse.  
6. **Assumptions / provenance:** Full provenance mandatory; `assumedBy: assumption-engine`.  
7. **Validation:** Irreversible or high-harm fields MUST NOT be assumed (e.g. medical).  
8. **Invariants:** No silent promotion to `confirmed`; user correction wins.  
9. **Failure modes:** No safe default.  
10. **Errors:** `INSUFFICIENT_INFORMATION`, `UNSUPPORTED_REQUEST`.  
11. **Timeout:** Soft 100ms / hard 300ms.  
12. **Fallback:** Leave `unknown` → clarify.  
13. **Privacy:** No identity assumptions.  
14. **Telemetry:** assumed field names + reversible flags.  
15. **Idempotency:** Yes.  
16. **Versioning:** `assumption-engine@1.x`.  
17. **Request:** missing cabin class.  
18. **Success:** assume `economy`, reversible.  
19. **Partial:** assume flexible month window with warning.  
20. **Failure:** cannot assume origin → empty assumptions + `INSUFFICIENT_INFORMATION`.  
21. **Acceptance:** Unit tests prove assumptions never written as `user_provided`/`confirmed`.

---

### I. MemoryReader

1. **Responsibility:** Read working / preference / trip / long-term snapshots with provenance.  
2. **Inputs:** `userIdHash`, `conversationId`, `scopes[]`.  
3. **Required / optional:** Required: scopes. Optional: `asOf` timestamp.  
4. **Outputs:** Scoped facts + confidence + kind.  
5. **Confidence:** Echoed per fact.  
6. **Assumptions / provenance:** Returns as stored; does not invent.  
7. **Validation:** User isolation — only facts for `userIdHash`.  
8. **Invariants:** Stale facts marked `stale`; invalidated facts omitted or flagged.  
9. **Failure modes:** Store unavailable.  
10. **Errors:** `TIMEOUT`, `PRIVACY_BLOCK`, `STALE_DATA`, `FALLBACK_USED`.  
11. **Timeout:** Soft 100ms / hard 500ms.  
12. **Fallback:** Empty working memory + warning; never cross-user data.  
13. **Privacy:** Long-term sensitive fields redacted unless needed.  
14. **Telemetry:** scope hit/miss counts.  
15. **Idempotency:** Read-only safe.  
16. **Versioning:** `memory-reader@1.x`.  
17. **Request:** scopes `[working, trip]`.  
18. **Success:** trip.destination Morocco confirmed.  
19. **Partial:** preference memory unavailable warning.  
20. **Failure:** `{ "errors": [{ "code": "PRIVACY_BLOCK" }] }`  
21. **Acceptance:** Cannot return another user’s facts; provenance present on all facts.

---

### J. MemoryWriter

1. **Responsibility:** Propose/commit memory writes with kind + confidence + provenance.  
2. **Inputs:** Fact proposals from extractors/reasoners (not raw model dumps).  
3. **Required / optional:** Required: `fact`, `kind`, `confidence`, `provenance`. Optional: `expiresAt`.  
4. **Outputs:** `accepted[]`, `rejected[]`, `pendingConfirmation[]`.  
5. **Confidence:** Stored verbatim; no promotion.  
6. **Assumptions / provenance:** Reject writes missing provenance for inferred/assumption.  
7. **Validation:** Refuse silent assumption→confirmed; enforce user isolation.  
8. **Invariants:** AgentMemory remains logical SoT when wired; Sprint 88 adapters remain unwired until approved.  
9. **Failure modes:** Conflict with newer user statement.  
10. **Errors:** `CONFLICTING_INFORMATION`, `VALIDATION_ERROR`, `PRIVACY_BLOCK`.  
11. **Timeout:** Soft 100ms / hard 500ms.  
12. **Fallback:** Keep in working memory only; warn.  
13. **Privacy:** No payment tokens; PII minimized.  
14. **Telemetry:** write counts by kind.  
15. **Idempotency:** Same `factId` rewrite is upsert; `requestId` dedupe.  
16. **Versioning:** `memory-writer@1.x`.  
17. **Request:** write destination Morocco `user_provided`/`confirmed`.  
18. **Success:** accepted.  
19. **Partial:** accepted to working only; long-term deferred.  
20. **Failure:** attempt to write assumption as confirmed → `INTERNAL_CONTRACT_VIOLATION`.  
21. **Acceptance:** Promotion without user confirmation impossible.

---

### K. MemoryCorrection

1. **Responsibility:** Apply traveler corrections; supersede prior facts; invalidate stale chain.  
2. **Inputs:** Correction utterance intent + field + new value.  
3. **Required / optional:** Required: `targetField` or resolvable reference, `newValue`. Optional: `reason`.  
4. **Outputs:** `supersededFactIds[]`, new fact `corrected`/`user_provided`.  
5. **Confidence:** New value typically `confirmed`.  
6. **Assumptions / provenance:** `supersedesFactId` mandatory when replacing.  
7. **Validation:** Must not leave conflicting active facts for same field.  
8. **Invariants:** Correction beats preferences and old assumptions.  
9. **Failure modes:** Unknown target.  
10. **Errors:** `AMBIGUOUS_REFERENCE`, `VALIDATION_ERROR`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Ask one clarification for target field.  
13. **Privacy:** Same as MemoryWriter.  
14. **Telemetry:** `fieldsCorrected`.  
15. **Idempotency:** Same correction payload → same terminal state.  
16. **Versioning:** `memory-correction@1.x`.  
17. **Request:** change destination Morocco → Turkey.  
18. **Success:** Morocco invalidated; Turkey confirmed.  
19. **Partial:** date corrected; dependent offers marked stale.  
20. **Failure:** `{ "errors": [{ "code": "AMBIGUOUS_REFERENCE" }] }`  
21. **Acceptance:** Prior assumptions on old destination invalidated.

---

### L. PreferenceMemory

1. **Responsibility:** Stable tastes (cabin, hotel class soft prefs, pace) — soft influence only.  
2. **Inputs / outputs:** Preference snapshot read/write via MemoryReader/Writer patterns.  
3. **Required / optional:** Optional fields by nature; empty OK.  
4. **Outputs:** Preference map with confidence/kind.  
5. **Confidence:** Usually inferred or user_provided; rarely blocking.  
6. **Assumptions / provenance:** Soft defaults labeled assumption if engine-applied.  
7. **Validation:** Preferences MUST NOT alone authorize search.  
8. **Invariants:** Lower priority than trip + latest statement (Brain Spec §5.5).  
9. **Failure modes:** Store miss.  
10. **Errors:** `STALE_DATA`, `FALLBACK_USED`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Empty preferences.  
13. **Privacy:** No sensitive health data without explicit consent model (future).  
14. **Telemetry:** preference keys present (boolean map).  
15. **Idempotency:** Yes.  
16. **Versioning:** `preference-memory@1.x`.  
17–20. **Examples:** Read empty; write `prefersDirectFlights=true` user_provided; partial store; failure privacy block.  
21. **Acceptance:** Never blocks clarify-before-search by itself.

---

### M. TripMemory

1. **Responsibility:** Active trip draft source of truth for planning fields.  
2. **Inputs:** Trip id + fact updates.  
3. **Required / optional:** `tripId` required when active; fields optional until known.  
4. **Outputs:** Trip snapshot.  
5. **Confidence:** Per field.  
6. **Assumptions / provenance:** Per field kinds.  
7. **Validation:** New trip invalidates prior trip-scoped offers.  
8. **Invariants:** Priority above preferences/long-term.  
9. **Failure modes:** Missing trip id when expected.  
10. **Errors:** `VALIDATION_ERROR`, `CONFLICTING_INFORMATION`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Create ephemeral working trip draft.  
13. **Privacy:** Trip PII minimized.  
14. **Telemetry:** `tripFieldFillRate`.  
15. **Idempotency:** Upsert by field.  
16. **Versioning:** `trip-memory@1.x`.  
17. **Request:** upsert destination Morocco.  
18. **Success:** snapshot with destination confirmed.  
19. **Partial:** dates unknown.  
20. **Failure:** conflicting concurrent writers → `CONFLICTING_INFORMATION`.  
21. **Acceptance:** Destination correction updates trip and marks dependent data stale.

---

### N. LongTermMemory

1. **Responsibility:** Cross-session facts when permitted.  
2. **Inputs:** Read/write with consent/retention metadata.  
3. **Required / optional:** `retentionClass` required on write.  
4. **Outputs:** Historical prefs/past destinations.  
5. **Confidence:** Often stale-prone; mark freshness.  
6. **Assumptions / provenance:** Never invent history.  
7. **Validation:** User isolation; deletion supported.  
8. **Invariants:** Lowest priority among memory types before defaults.  
9. **Failure modes:** Unavailable / disabled.  
10. **Errors:** `PRIVACY_BLOCK`, `STALE_DATA`, `FALLBACK_USED`.  
11. **Timeout:** Soft 150ms / hard 600ms.  
12. **Fallback:** Skip long-term; continue.  
13. **Privacy:** Highest scrutiny; default redaction in telemetry.  
14. **Telemetry:** `longTermUsed` boolean only.  
15. **Idempotency:** Yes.  
16. **Versioning:** `long-term-memory@1.x`.  
17–20. **Examples:** hit past “likes beach”; partial expired; privacy block; deletion ack.  
21. **Acceptance:** Supports expiry/deletion; never overrides explicit current correction.

---

### O. ConversationPlanner

1. **Responsibility:** Plan the conversational move for this turn (acknowledge, advise, clarify, refine) without exposing workflow.  
2. **Inputs:** Intent, missing info, clarification decision, value-first plan, reasoner summary.  
3. **Required / optional:** Required: `moveType`. Optional: `tone`.  
4. **Outputs:** Structured dialogue plan for ResponseGenerator.  
5. **Confidence:** Plan confidence.  
6. **Assumptions / provenance:** Includes which assumptions may be voiced softly.  
7. **Validation:** If `shouldAsk`, plan contains exactly one ask slot.  
8. **Invariants:** Shared for voice and text; no form wizard moves.  
9. **Failure modes:** Contradictory shouldAsk vs moveType.  
10. **Errors:** `INTERNAL_CONTRACT_VIOLATION`.  
11. **Timeout:** Soft 200ms / hard 800ms.  
12. **Fallback:** Value-first + optional single clarify.  
13. **Privacy:** No secrets in plan.  
14. **Telemetry:** `moveType`, `askCount`.  
15. **Idempotency:** Yes for same inputs.  
16. **Versioning:** `conversation-planner@1.x`.  
17. **Request:** plan_trip + blocking dates/origin.  
18. **Success:** move `value_then_clarify`.  
19. **Partial:** move `advise_only` with warnings.  
20. **Failure:** `askCount: 2` → violation.  
21. **Acceptance:** Aligns with Brain Spec conversation quality rules.

---

### P. TravelReasoner

1. **Responsibility:** Reason about fit, tradeoffs, conflicts, and next justified action inside the hierarchy.  
2. **Inputs:** Memory + entities + destination knowledge + missing info.  
3. **Required / optional:** Required: understanding snapshot. Optional: offers if already present.  
4. **Outputs:** `reasoningSummary` (structured, **not** chain-of-thought), `conflicts[]`, `recommendedAction`.  
5. **Confidence:** Overall + per conclusion.  
6. **Assumptions / provenance:** Lists assumptions used.  
7. **Validation:** `recommendedAction` ∈ hierarchy-allowed set.  
8. **Invariants:** No private CoT in outputs; user-safe summaries only.  
9. **Failure modes:** Irreconcilable conflict.  
10. **Errors:** `CONFLICTING_INFORMATION`, `TIMEOUT`, `FALLBACK_USED`.  
11. **Timeout:** Soft 1000ms / hard 3000ms.  
12. **Fallback:** Deterministic heuristic reasoner.  
13. **Privacy:** Strip sensitive evidence from summaries.  
14. **Telemetry:** `recommendedAction`, `conflictCount`.  
15. **Idempotency:** Pin model/deterministic version.  
16. **Versioning:** `travel-reasoner@1.x`.  
17. **Request:** Morocco plan, missing dates.  
18. **Success:** action `clarify`, summary tradeoff notes empty.  
19. **Partial:** action `advise_without_search` medium confidence.  
20. **Failure:** timeout → fallback used.  
21. **Acceptance:** Never outputs chain-of-thought; never recommends search when blocking missing.

---

### Q. DestinationKnowledge

1. **Responsibility:** Provide destination facts/themes for advisory reasoning (catalog/knowledge, not live inventory).  
2. **Inputs:** Destination id/name + locale.  
3. **Required / optional:** Required: destination key. Optional: travel month.  
4. **Outputs:** Themes, seasonality notes, caveats — explainable.  
5. **Confidence:** Per claim.  
6. **Assumptions / provenance:** Knowledge base provenance ids.  
7. **Validation:** Unknown destination → empty + warning, not fabrication.  
8. **Invariants:** Not a substitute for search; no geo hardcoded rank weights in shared ranker.  
9. **Failure modes:** KB miss.  
10. **Errors:** `UNSUPPORTED_REQUEST`, `STALE_DATA`, `TIMEOUT`.  
11. **Timeout:** Soft 200ms / hard 1000ms.  
12. **Fallback:** Generic travel advice without local claims.  
13. **Privacy:** Public knowledge only.  
14. **Telemetry:** `destinationKey`, `hit`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `destination-knowledge@1.x`.  
17. **Request:** Morocco.  
18. **Success:** themes `[culture, food, cities]`.  
19. **Partial:** limited seasonality unknown.  
20. **Failure:** unknown place id.  
21. **Acceptance:** No invented visa certainty; no live prices.

---

### R. ConfidenceEngine

1. **Responsibility:** Aggregate and normalize confidence across fields and decisions.  
2. **Inputs:** Facts, extractor confidences, ASR confidence.  
3. **Required / optional:** Required: field confidences. Optional: weights config.  
4. **Outputs:** Field map + decision thresholds (`canSearch`, `shouldClarify`).  
5. **Confidence:** Meta-confidence.  
6. **Assumptions / provenance:** Propagates lowest relevant confidence for blocking fields.  
7. **Validation:** Threshold config has no geo hardcoding.  
8. **Invariants:** `canSearch=false` when any blocking field unknown/conflicting/stale.  
9. **Failure modes:** Missing threshold config.  
10. **Errors:** `VALIDATION_ERROR`, `INTERNAL_CONTRACT_VIOLATION`.  
11. **Timeout:** Soft 50ms / hard 200ms.  
12. **Fallback:** Conservative thresholds.  
13. **Privacy:** N/A beyond field names.  
14. **Telemetry:** `canSearch`, `shouldClarify`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `confidence-engine@1.x`.  
17. **Request:** destination confirmed; dates unknown.  
18. **Success:** `canSearch: false`, `shouldClarify: true`.  
19. **Partial:** medium inferred dates → `canSearch: false` if policy requires confirmed/high.  
20. **Failure:** invalid level string.  
21. **Acceptance:** Matches clarify-before-search gate.

---

### S. ValueFirstPlanner

1. **Responsibility:** Produce preliminary consultant value **before** or **without** interrogation; may coexist with ≤1 clarify.  
2. **Inputs:** Intent + destination knowledge + memory.  
3. **Required / optional:** Required: intent. Optional: partial entities.  
4. **Outputs:** `preliminaryValue` structured bullets/themes (not user-final copy).  
5. **Confidence:** Value confidence.  
6. **Assumptions / provenance:** May use soft assumptions explicitly listed.  
7. **Validation:** Must not require search; must not ask >0 here (asks owned by ClarificationPolicy).  
8. **Invariants:** Reject question-only turns when value possible (Golden G01).  
9. **Failure modes:** No value possible.  
10. **Errors:** `INSUFFICIENT_INFORMATION`, `FALLBACK_USED`.  
11. **Timeout:** Soft 300ms / hard 1000ms.  
12. **Fallback:** Short destination-agnostic travel coaching line.  
13. **Privacy:** Public themes only.  
14. **Telemetry:** `valueEmitted`, `usedDestinationKnowledge`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `value-first-planner@1.x`.  
17. **Request:** Morocco plan_trip.  
18. **Success:** preliminary themes + planning angle.  
19. **Partial:** generic Maghreb-safe themes with medium confidence.  
20. **Failure:** empty intent.  
21. **Acceptance:** Golden G01-compatible: value before question when possible.

---

### T. ToolDecisionEngine

1. **Responsibility:** Decide whether tools/search are justified **after** reason/clarify gates.  
2. **Inputs:** ConfidenceEngine + MissingInformation + TravelReasoner action.  
3. **Required / optional:** Required: `canSearch`, `blocking[]`. Optional: domain list.  
4. **Outputs:** `decision` = `search` \| `wait` \| `recommend_without_search` \| `clarify` \| `none`.  
5. **Confidence:** Decision confidence.  
6. **Assumptions / provenance:** Lists assumptions that would be relied on if searching.  
7. **Validation:** If blocking non-empty → MUST NOT return `search`.  
8. **Invariants:** Auditable; no secrets; no gateway side effects in this contract.  
9. **Failure modes:** Conflicting inputs.  
10. **Errors:** `INSUFFICIENT_INFORMATION`, `INTERNAL_CONTRACT_VIOLATION`, `SAFETY_BLOCK`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** `clarify` or `recommend_without_search`.  
13. **Privacy:** Tool args redacted in telemetry.  
14. **Telemetry:** `decision`, `domainsRequested`, `blocked`.  
15. **Idempotency:** Yes; decision-only.  
16. **Versioning:** `tool-decision-engine@1.x`.  
17. **Request:** canSearch false.  
18. **Success:** `decision: "clarify"`.  
19. **Partial:** `recommend_without_search` with warnings.  
20. **Failure:** decision search while blocking → violation.  
21. **Acceptance:** Property test: blocking ≠ ∅ ⇒ decision ≠ search.

---

### U. SearchHandoffDecision

1. **Responsibility:** Decision-only contract for whether Option A soft-enrich continue is eligible; **does not execute search** unless separately approved later.  
2. **Inputs:** ToolDecision + ClarificationPolicy + flag/environment gates.  
3. **Required / optional:** Required: sufficiency boolean, missingFields.  
4. **Outputs:** Handoff hint aligned with Sprint 88 `SearchHandoffHint`:  
   - `early_return_locked`  
   - `blocked_insufficient_information` (`mustNotInvokeSearchOrGateway: true`)  
   - `soft_enrich_continue` (future)  
   - `none`  
5. **Confidence:** Eligibility confidence.  
6. **Assumptions / provenance:** Record assumptions that would be needed for sufficiency.  
7. **Validation:** Insufficient ⇒ blocked hint with mustNotInvoke.  
8. **Invariants:** Current product lock remains early-return until approved implementation; no parallel gateway.  
9. **Failure modes:** Preview disabled; prod hard-block.  
10. **Errors:** `INSUFFICIENT_INFORMATION`, `UNSUPPORTED_REQUEST`, `SAFETY_BLOCK`.  
11. **Timeout:** Soft 50ms / hard 200ms.  
12. **Fallback:** `early_return_locked` or `blocked_insufficient_information`.  
13. **Privacy:** missing field names only.  
14. **Telemetry:** `handoffKind`, `previewEnabled`, `mustNotInvoke`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `search-handoff-decision@1.0.0` compatible with `sprint88-preview-orchestrator-1`.  
17. **Request:** insufficient Morocco-only.  
18. **Success:** `blocked_insufficient_information` + missingFields.  
19. **Partial:** N/A — decision is discrete; warnings for flag OFF.  
20. **Failure:** attempt to emit soft_enrich while insufficient → violation.  
21. **Acceptance:** ADR §3 normative; zero gateway side effects from this contract alone.

---

### V. DomainIntelligence

1. **Responsibility:** Shared domain module contract (Sprint 88 interface surface): buildQuery / execute / rank / explain.  
2. **Inputs:** Plan, memory, prefs, `ProviderGateway` (execute path only when eligible).  
3. **Required / optional:** Per Sprint 88 `DomainIntelligence` fields: id, timeouts, retry, fallback.  
4. **Outputs:** `DomainResult` with offers, ranked, explainability, assumptions, errors, provenance, telemetry.  
5. **Confidence:** Via offer provenance + assumptions.  
6. **Assumptions / provenance:** DomainAssumption source tags.  
7. **Validation:** `buildQuery` may skip; execute MUST use `src/core/providerGateway` only when implemented.  
8. **Invariants:** No parallel fabric; no geo-hardcoded shared ranking rules; clarify-before-search outside execute.  
9. **Failure modes:** Gateway down; skip; partial.  
10. **Errors:** `PROVIDER_UNAVAILABLE`, `TOOL_FAILURE`, `TIMEOUT`, `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** softMs/hardMs from domain policy.  
12. **Fallback:** `skip_domain` \| `indicative_only` \| `clarify_once`.  
13. **Privacy:** Sanitize errorClass; no raw provider payloads in telemetry.  
14. **Telemetry:** DomainTelemetry fields.  
15. **Idempotency:** execute reads SHOULD be idempotent; retries only if marked safe.  
16. **Versioning:** `domain-intelligence@1.x` / `sprint88-domain-intelligence-1`.  
17. **Request:** buildQuery with sufficient memory (future).  
18. **Success:** status `ok` with ranked offers.  
19. **Partial:** status `partial`.  
20. **Failure:** status `error` + `PROVIDER_UNAVAILABLE`.  
21. **Acceptance:** Contract tests match Sprint 88 types; execute not required for AI Contracts v1 doc acceptance.

---

### W. FlightIntelligence

1. **Responsibility:** Flight-specialized DomainIntelligence.  
2. **Inputs:** Origin, destination, dates/flex, party, cabin prefs.  
3. **Required / optional for search eligibility:** origin, destination, usable dates/flex — blocking if missing.  
4. **Outputs:** Normalized flight offers.  
5. **Confidence:** Per offer.  
6. **Assumptions / provenance:** e.g. assumed cabin economy.  
7. **Validation:** buildQuery skips if insufficient.  
8. **Invariants:** No search while blocked; gateway-only execute.  
9. **Failure modes:** Empty inventory.  
10. **Errors:** Domain errors + `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** Domain policy.  
12. **Fallback:** skip or indicative_only.  
13. **Privacy:** Standard domain redaction.  
14. **Telemetry:** domain=`flight`.  
15. **Idempotency:** Read idempotent.  
16. **Versioning:** `flight-intelligence@1.x`.  
17–20. **Examples:** skip insufficient; ok ranks; partial mixed providers; provider unavailable.  
21. **Acceptance:** Insufficient origin/dates → skip/clarify, never gateway.

---

### X. HotelIntelligence

1. **Responsibility:** Hotel domain intelligence.  
2. **Inputs:** Destination, stay dates/nights, party, star/refundable prefs.  
3. **Required / optional:** destination + stay window typically blocking.  
4. **Outputs:** Normalized hotel offers.  
5–16. **Same pattern as DomainIntelligence** with id `hotel`.  
17–20. **Examples:** analogous to flights.  
21. **Acceptance:** Ranking weights from RankingConfig only — no city hardcoding in shared contract.

---

### Y. ActivityIntelligence

1. **Responsibility:** Activities/experiences domain.  
2. **Inputs:** Destination, dates/flex, party, interest tags.  
3. **Required / optional:** destination usually required; exact dates often deferrable for advice.  
4. **Outputs:** Normalized activity offers / suggestions.  
5–16. Pattern as DomainIntelligence id `activity`.  
17–20. Advice-without-search allowed when ToolDecision says so.  
21. **Acceptance:** May recommend without execute when decision is `recommend_without_search`.

---

### Z. CarIntelligence

1. **Responsibility:** Car rental domain.  
2. **Inputs:** Pick-up/drop-off, times, driver age band if required by policy later.  
3. **Required / optional:** location + dates blocking for search.  
4. **Outputs:** Normalized car offers.  
5–21. Same domain pattern; id `car`.  
**Note:** Driver license/passport are booking-stage, not search-blocking in explore.

---

### AA. VisaGuidanceIntelligence

1. **Responsibility:** **Guidance-only** visa information; non-authoritative; post-core.  
2. **Inputs:** Nationality (if user-provided), destination.  
3. **Required / optional:** Explicit disclaimer required in outputs.  
4. **Outputs:** Guidance notes + uncertainty; **not** normalized bookable offers.  
5. **Confidence:** Typically medium/unknown — never confirmed legal advice.  
6. **Assumptions / provenance:** KB provenance; encourage official verification.  
7. **Validation:** Must not claim issuance guarantees.  
8. **Invariants:** Does not authorize search sufficiency; does not execute booking.  
9. **Failure modes:** Unknown nationality.  
10. **Errors:** `INSUFFICIENT_INFORMATION`, `UNSUPPORTED_REQUEST`.  
11. **Timeout:** Soft 200ms / hard 1000ms.  
12. **Fallback:** Generic “verify with official sources”.  
13. **Privacy:** Nationality is sensitive — minimize; redact in telemetry.  
14. **Telemetry:** `visaGuidanceUsed` boolean.  
15. **Idempotency:** Yes.  
16. **Versioning:** `visa-guidance@1.x`.  
17. **Request:** Saudi traveler → Morocco (if nationality known).  
18. **Success:** guidance + disclaimer.  
19. **Partial:** unknown rules → advise check embassy.  
20. **Failure:** missing nationality for specific guidance.  
21. **Acceptance:** No booking; no hard legal claims; not required for core trip explore.

---

### AB. BudgetAndPricingIntelligence

1. **Responsibility:** Budget fit and price comparison reasoning over normalized offers / estimates.  
2. **Inputs:** Budget fact + ranked offers + currency.  
3. **Required / optional:** Budget optional for advise; required for hard budget filter claims.  
4. **Outputs:** Fit labels, tradeoffs, over-budget flags.  
5. **Confidence:** Price confidence respects offer staleness.  
6. **Assumptions / provenance:** FX assumptions explicit.  
7. **Validation:** Stale offers → `STALE_DATA` warning; no silent FX invention beyond declared assumption.  
8. **Invariants:** Comparable only via NormalizedOffer money fields.  
9. **Failure modes:** Currency unknown.  
10. **Errors:** `STALE_DATA`, `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** Soft 200ms / hard 800ms.  
12. **Fallback:** Qualitative budget advice without numbers.  
13. **Privacy:** Budget amounts treated sensitive in telemetry (bucket only).  
14. **Telemetry:** `budgetFit`, `offerCount`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `budget-pricing@1.x`.  
17–20. **Examples:** under budget; partial FX; stale prices; missing budget.  
21. **Acceptance:** Never presents stale prices as live confirmed.

---

### AC. OfferNormalizer

1. **Responsibility:** Map provider-specific payloads to `NormalizedOffer`.  
2. **Inputs:** Raw provider DTO (future execute path) + provider id.  
3. **Required / optional:** Required normalized fields per Sprint 88 NormalizedOffer.  
4. **Outputs:** `NormalizedOffer[]`.  
5. **Confidence:** provenance.confidence.  
6. **Assumptions / provenance:** providerId, fetchedAt, requestId.  
7. **Validation:** money.currency required; unknown baggage/cancel statuses allowed.  
8. **Invariants:** No ranking here; no geo rules.  
9. **Failure modes:** Unmappable payload.  
10. **Errors:** `VALIDATION_ERROR`, `TOOL_FAILURE`.  
11. **Timeout:** Soft 100ms / hard 500ms per batch.  
12. **Fallback:** Drop offer + warning.  
13. **Privacy:** Strip passenger PII if present in raw.  
14. **Telemetry:** `normalizedCount`, `droppedCount`.  
15. **Idempotency:** Same raw + version → same offer id strategy.  
16. **Versioning:** `offer-normalizer@1.x`.  
17–20. **Examples:** flight ok; partial taxes unknown; validation error; empty batch.  
21. **Acceptance:** Cross-provider fields comparable; dedupeGroupId optional but stable when present.

---

### AD. OfferRanker

1. **Responsibility:** Rank normalized offers with configurable `RankingConfig` weights.  
2. **Inputs:** Offers + prefs + RankingConfig.  
3. **Required / optional:** Weights required (defaults allowed).  
4. **Outputs:** `RankedNormalizedOffer[]` with score, rank, reasons[].  
5. **Confidence:** Reflects input freshness.  
6. **Assumptions / provenance:** Reasons user-safe; no CoT.  
7. **Validation:** **Forbidden:** geography-specific hardcoded rules in shared ranker.  
8. **Invariants:** Deterministic given inputs + config version.  
9. **Failure modes:** Empty offers.  
10. **Errors:** `VALIDATION_ERROR`, `STALE_DATA`.  
11. **Timeout:** Soft 100ms / hard 500ms.  
12. **Fallback:** Price-ascending stable sort with `FALLBACK_USED`.  
13. **Privacy:** Reasons without PII.  
14. **Telemetry:** `topScore`, `configVersion`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `offer-ranker@1.x`.  
17. **Request:** 3 flight offers + default weights.  
18. **Success:** ranked 1..n with reasons.  
19. **Partial:** stale warning on some offers demoted.  
20. **Failure:** invalid weights.  
21. **Acceptance:** Config changes alter rank; no city if/else in shared contract.

---

### AE. ItineraryBuilder

1. **Responsibility:** Compose itinerary / day-plan direction from advice + optional offers.  
2. **Inputs:** Trip memory + reasoner + optional ranked offers.  
3. **Required / optional:** Destination required for concrete itinerary; dates optional for sketch.  
4. **Outputs:** Structured itinerary outline (days/themes), not booking records.  
5. **Confidence:** Per day/item.  
6. **Assumptions / provenance:** List pacing assumptions.  
7. **Validation:** No passport/payment steps in explore itinerary.  
8. **Invariants:** Consultant plan, not ticket.  
9. **Failure modes:** Insufficient destination.  
10. **Errors:** `INSUFFICIENT_INFORMATION`.  
11. **Timeout:** Soft 500ms / hard 2000ms.  
12. **Fallback:** High-level destination themes only.  
13. **Privacy:** No PII.  
14. **Telemetry:** `dayCount`, `usedOffers`.  
15. **Idempotency:** Pin version.  
16. **Versioning:** `itinerary-builder@1.x`.  
17–20. **Examples:** 5-day Morocco sketch; partial without dates; failure no destination; fallback themes.  
21. **Acceptance:** Golden booking-deferral: no identity/payment asks.

---

### AF. ResponseGenerator

1. **Responsibility:** Produce final user-facing consultant message(s) from plans — Arabic RTL capable.  
2. **Inputs:** ConversationPlanner + ValueFirst + Clarify + Itinerary + Explainability.  
3. **Required / optional:** Required: `moveType`. Optional: voice ssml hints **outside** Brain (channel may adapt).  
4. **Outputs:** `messages[]` user-safe text; `ask` optional single question.  
5. **Confidence:** N/A or delivery confidence.  
6. **Assumptions / provenance:** May soft-surface assumptions in human language without calling them “assumptions”.  
7. **Validation:** Forbidden workflow vocabulary (Brain Spec §1.4); ≤1 question.  
8. **Invariants:** Same generator for voice/text semantic content; TTS outside contract.  
9. **Failure modes:** Empty plan.  
10. **Errors:** `VALIDATION_ERROR`, `SAFETY_BLOCK`, `FALLBACK_USED`.  
11. **Timeout:** Soft 800ms / hard 2500ms.  
12. **Fallback:** Safe short apology + invite retry (Golden G05 posture).  
13. **Privacy:** Never echo secrets; redact.  
14. **Telemetry:** `messageLengthBucket`, `askCount`, `locale`.  
15. **Idempotency:** Pin model version for evals.  
16. **Versioning:** `response-generator@1.x`.  
17. **Request:** value_then_clarify Morocco.  
18. **Success:** value paragraph + one merged question.  
19. **Partial:** value only, medium confidence caveats.  
20. **Failure:** safety block message.  
21. **Acceptance:** No state/flag/tool names in user text.

---

### AG. ExplainabilityResult

1. **Responsibility:** User-safe why-this / alternatives — **not** private chain-of-thought.  
2. **Inputs:** Ranked offers / destination recommendation / reasoner conclusions.  
3. **Required / optional:** Required: `whyTop[]`. Optional: `alternatives[]`, `evidenceRefs[]`.  
4. **Outputs:** ExplainabilityResult structure.  
5. **Confidence:** Optional per reason.  
6. **Assumptions / provenance:** Evidence refs only.  
7. **Validation:** Reject payloads containing CoT markers / tool traces / secrets.  
8. **Invariants:** Concise; consultant-safe.  
9. **Failure modes:** Nothing to explain.  
10. **Errors:** `VALIDATION_ERROR`, `PRIVACY_BLOCK`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Empty explainability with warning.  
13. **Privacy:** Strip internal ids if user-facing.  
14. **Telemetry:** `reasonCount`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `explainability@1.x`.  
17. **Request:** top flight choice.  
18. **Success:** whyTop: ["أقصر مدة", "ضمن الميزانية"].  
19. **Partial:** fewer reasons.  
20. **Failure:** CoT detected → `PRIVACY_BLOCK` / validation.  
21. **Acceptance:** Eval red-teams reject hidden reasoning leakage.

---

### AH. SafetyPolicy

1. **Responsibility:** Gate disallowed / unsafe / privacy-violating requests.  
2. **Inputs:** ConversationInput + planned actions + tool decisions.  
3. **Required / optional:** Required: content + intended action.  
4. **Outputs:** `allow` \| `refuse` \| `redirect` + userSafeSummary.  
5. **Confidence:** Policy confidence.  
6. **Assumptions / provenance:** Rule ids (internal).  
7. **Validation:** Jailbreak attempts do not authorize tool abuse.  
8. **Invariants:** Fail closed on safety; Brain principles preserved.  
9. **Failure modes:** Ambiguous harmful intent.  
10. **Errors:** `SAFETY_BLOCK`, `PRIVACY_BLOCK`, `UNSUPPORTED_REQUEST`.  
11. **Timeout:** Soft 100ms / hard 400ms.  
12. **Fallback:** Refuse with brief human message.  
13. **Privacy:** Do not echo harmful content in telemetry.  
14. **Telemetry:** `decision`, `ruleClass`.  
15. **Idempotency:** Yes.  
16. **Versioning:** `safety-policy@1.x`.  
17–20. **Examples:** allow trip plan; refuse prohibited; privacy block; timeout fail-closed refuse.  
21. **Acceptance:** Cannot be overridden by user “ignore rules” text.

---

### AI. FailureRecovery

1. **Responsibility:** Map failures to Recovery state posture and safe next move (Brain Spec §8).  
2. **Inputs:** errors[] from any contract + ConversationState.  
3. **Required / optional:** Required: error codes. Optional: partial artifacts.  
4. **Outputs:** `recoveryAction` (`fallback_planner` \| `clarify` \| `advise_without_tools` \| `safe_message` \| `abort_tools`), state hint.  
5. **Confidence:** N/A.  
6. **Assumptions / provenance:** Preserve trustworthy memory; discard corrupt.  
7. **Validation:** Must not cascade unbounded tool retries.  
8. **Invariants:** No silent failure; no gateway on insufficient info; preserve turn owner.  
9. **Failure modes:** Nested recovery failure → ultimate safe message.  
10. **Errors:** may emit `FALLBACK_USED`.  
11. **Timeout:** Soft 50ms / hard 200ms.  
12. **Fallback:** Static safe consultant message.  
13. **Privacy:** Sanitize all outbound.  
14. **Telemetry:** `recoveryAction`, `sourceErrorCode`.  
15. **Idempotency:** Same error class → same action class.  
16. **Versioning:** `failure-recovery@1.x`.  
17. **Request:** ToolDecision internal failure.  
18. **Success:** `fallback_planner` + safe message plan.  
19. **Partial:** advise_without_tools with warnings.  
20. **Failure:** ultimate static safe message.  
21. **Acceptance:** Golden G05 safe fallback posture.

---

### AJ. ShadowTelemetryEvent

1. **Responsibility:** Evaluation metadata event for preview/shadow — no production registration required by this spec.  
2. **Inputs:** Turn summary metrics.  
3. **Required / optional:** Align Sprint 88: `traceId`, `timestamp`, `plannerVersion`, `previewEnabled`, `fallbackTriggered`, `executionStage`, `latencyBucket`, `resultStatus`; optional `conversationId`, `scenarioId`, `errorCategory`.  
4. **Outputs:** Emitted event to in-memory/sink (when implemented).  
5. **Confidence:** N/A.  
6. **Assumptions / provenance:** N/A.  
7. **Validation:** Forbidden: user messages, passport, names, emails, phones, payment, booking ids, provider payloads, raw search queries.  
8. **Invariants:** Privacy-safe; default OFF wiring.  
9. **Failure modes:** Drop event on validation fail.  
10. **Errors:** `PRIVACY_BLOCK`, `VALIDATION_ERROR`.  
11. **Timeout:** Emit async best-effort; never block turn > hard 50ms.  
12. **Fallback:** Drop.  
13. **Privacy:** Maximum redaction.  
14. **Telemetry:** Self.  
15. **Idempotency:** Same `traceId`+stage may dedupe.  
16. **Versioning:** `shadow-telemetry@1.x`.  
17–20. **Examples:** ok complete; fallback; privacy block drop; cancelled.  
21. **Acceptance:** Redaction tests from Sprint 88 remain normative.

---

### AK. GoldenEvaluationCase

1. **Responsibility:** Deterministic eval case contract (G01–G05 and extensions).  
2. **Inputs:** Fixture utterance sequence + expectations.  
3. **Required / optional:** Required: `id`, `turns[]`, `expect`. Optional: tags.  
4. **Outputs:** Pass/fail + violations[].  
5. **Confidence:** N/A.  
6. **Assumptions / provenance:** Fixtures declare expected provenance when relevant.  
7. **Validation:** No LLM-as-judge required for v1 skeleton.  
8. **Invariants:** Tests may enable preview only inside eval harness; production flags remain OFF.  
9. **Failure modes:** Fixture drift.  
10. **Errors:** eval harness `VALIDATION_ERROR`.  
11. **Timeout:** Per suite budget.  
12. **Fallback:** N/A.  
13. **Privacy:** Fixtures use synthetic data only.  
14. **Telemetry:** scenarioId linkage.  
15. **Idempotency:** Deterministic.  
16. **Versioning:** `golden-eval@1.x`.  
17. **Request:** G01 value-first fixture.  
18. **Success:** pass.  
19. **Partial:** N/A.  
20. **Failure:** fail with violation `question_only_turn`.  
21. **Acceptance:** G01–G05 expressible under this contract.

---

### AL. BrainTurnResult

1. **Responsibility:** Unified turn result returned toward `planTurn` / provider meta — the aggregation of the pipeline.  
2. **Inputs:** All upstream contract outputs for the turn.  
3. **Required / optional:**  
   - Required: `turnId`, `messages`, `brainState`, `toolDecision`, `searchHandoffDecision`, `memoryProposals`, `explainability`, `errors`, `warnings`.  
   - Optional: `itinerary`, `rankedOffers`, `preliminaryValue`, `clarification`, `shadowHints`.  
4. **Outputs:** BrainTurnResult envelope+payload.  
5. **Confidence:** Aggregate turn confidence.  
6. **Assumptions / provenance:** Full assumption list for the turn.  
7. **Validation:** If handoff blocked insufficient → messages may clarify; toolBatch/search execute MUST be null/absent.  
8. **Invariants:** Does not replace `planTurn`; flags remain OFF; no `ai.tie.v1`; booking/payment absent.  
9. **Failure modes:** Partial pipeline → Recovery composition.  
10. **Errors:** Any taxonomy codes bubbled + possibly `FALLBACK_USED`.  
11. **Timeout:** Bound by planTurn overall budget; cancel propagates `CANCELLED`.  
12. **Fallback:** FailureRecovery safe result.  
13. **Privacy:** User messages in result for UI only; not for shadow telemetry raw.  
14. **Telemetry:** status, handoff kind, askCount, decision.  
15. **Idempotency:** Same turn inputs → same result under pinned versions (eval).  
16. **Versioning:** `brain-turn-result@1.x`.  
17–20. See end-to-end examples in §9.  
21. **Acceptance:** Production path unchanged while unimplemented; contract consumable by future preview soft-wire without new turn owner.

---

## 9. End-to-end examples

### 9.1 Complete flow — «أريد رحلة إلى المغرب»

```text
ConversationInput (text, ar)
→ IntentExtractor: plan_trip (high)
→ EntityExtractor: trip.destination=Morocco (confirmed, user_provided)
→ ReferenceResolver: none
→ MemoryReader: empty trip
→ MissingInformationPlanner: blocking [origin, dates]; defer passport
→ AssumptionEngine: optional cabin=economy (assumption) only; NOT origin/dates
→ ConfidenceEngine: canSearch=false; shouldClarify=true
→ ValueFirstPlanner: Morocco themes / planning angle
→ ClarificationPolicy: shouldAsk=true; one merged question (من أين ومتى تقريبًا؟)
→ ConversationPlanner: value_then_clarify
→ TravelReasoner: recommendedAction=clarify
→ ToolDecisionEngine: clarify
→ SearchHandoffDecision: blocked_insufficient_information (mustNotInvokeSearchOrGateway=true)
→ DomainIntelligence*: skipped (not eligible)
→ ResponseGenerator: value + one question
→ ExplainabilityResult: destination themes (user-safe)
→ MemoryWriter proposals: destination confirmed
→ BrainTurnResult: messages + handoff blocked + toolDecision clarify
```

\* No Provider Gateway invocation.

### 9.2 Multi-turn refinement

**Turn 1:** Morocco stated → clarify origin/dates (as above).  
**Turn 2:** «من جدة، أول أسبوع من أكتوبر، شخصين»  

```text
Intent: refine_trip
Entities: origin=JED, dates≈2026-10-01.., adults=2 (confirmed)
MemoryCorrection/Writer: fill trip fields
MissingInformationPlanner: blocking [] for advise; search may become eligible later
ValueFirst + Reasoner: advise / optional tool decision
ClarificationPolicy: shouldAsk=false (Golden G02 posture)
ToolDecision: recommend_without_search OR search (only if execute path approved AND sufficient)
SearchHandoffDecision: still early_return_locked under current Sprint 88 product lock
BrainTurnResult: refined plan advice; no repeated destination question
```

### 9.3 Correction example (date or destination)

**Prior:** destination Morocco, dates first week of October.  
**User:** «صرت أبغى تركيا بدل المغرب»

```text
IntentExtractor: isCorrection=true
MemoryCorrection: supersede destination Morocco → Turkey (confirmed)
Invalidate: Morocco-specific assumptions, knowledge cache, any offers (stale)
TripMemory: updated
MissingInformationPlanner: re-evaluate (origin/party may still hold)
ClarificationPolicy: do not re-ask origin if confirmed
ResponseGenerator: acknowledge change; continue consultant flow for Turkey
```

### 9.4 Clarify-before-search

Given blocking fields non-empty:

| Contract | Must output |
| --- | --- |
| ConfidenceEngine | `canSearch: false` |
| ToolDecisionEngine | not `search` |
| SearchHandoffDecision | `blocked_insufficient_information` + `mustNotInvokeSearchOrGateway: true` |
| DomainIntelligence.execute | **not called** |
| Provider Gateway | **not called** |

### 9.5 Safe fallback

Brain/reasoner timeout:

```text
FailureRecovery → fallback_planner / safe_message
ShadowTelemetryEvent: fallbackTriggered=true, resultStatus=fallback
ResponseGenerator: calm consultant message; invite retry
SearchHandoffDecision: none / early_return_locked
No gateway; no silent failure (Golden G05)
```

### 9.6 Voice-originated request (shared contracts)

```text
[STT adapter OUT OF BRAIN CONTRACTS] → text transcript
ConversationInput {
  source: "voice_transcript",
  payload: { channel: "voice", text: "أبي أروح المغرب", asrConfidence: 0.81 }
}
→ IntentExtractor / EntityExtractor / … / BrainTurnResult
```

Only `source`, `channel`, and ASR metadata differ from text.  
**No separate voice planner contract inside the Brain.**

---

## 10. Contract versioning policy

1. **Package version:** `ai-contracts-v1.MAJOR.MINOR` documented here; this file is **v1.0.0**.  
2. **Per-contract versions:** `name@MAJOR.MINOR.PATCH`.  
3. **Compatible (MINOR/PATCH):** Additive optional fields; new enum values tolerated by clients with `unknown` handling.  
4. **Breaking (MAJOR):** Removing/renaming required fields; changing meaning of confidence levels; weakening clarify-before-search; adding parallel gateway; introducing `ai.tie.v1`.  
5. **Promotion rule changes** for confidence are always **MAJOR**.  
6. **Sprint 88 type names** remain compatible aliases where noted (`SearchHandoffHint`, `DomainIntelligence`, `NormalizedOffer`).  
7. Implementations MUST advertise `contractVersion` in envelope.  
8. Eval fixtures pin versions for determinism.

---

## 11. Compatibility matrix

| Component / era | AI Contracts v1 | Notes |
| --- | --- | --- |
| Brain Specification v1 | Compatible | Contracts implement Brain behavior seams |
| Sprint 88 preview contracts | Compatible subset | SearchHandoffHint / DomainIntelligence / NormalizedOffer |
| Sprint 88 memory adapters | Compatible | Reader/Writer/Correction map to adapter responsibilities |
| Sprint 88 golden G01–G05 | Compatible | Expressible via GoldenEvaluationCase |
| Sprint 88 shadow telemetry | Compatible | ShadowTelemetryEvent superset/align |
| Sprint 89 AI-first revision | Compatible | Phases map to contract groups; no impl authorized by this doc |
| `planTurn` sole owner | Required | BrainTurnResult is output, not a new owner |
| `ai.brain.v1` | Must stay OFF | |
| `ai.brain.v1.preview` | OFF default; prod hard-block | |
| `ai.tie.v1` | **Forbidden** | |
| Provider Gateway parallel fabric | **Forbidden** | |
| Booking / payment execution | Out of scope | Future boundaries only |
| STT/TTS | Out of Brain contracts | Channel only |

---

## 12. Definition of Done — AI Contracts v1 (documentation)

- [x] Document created at `docs/AI_CONTRACTS_v1.md`  
- [x] Shared envelope, confidence model, error taxonomy defined  
- [x] Contracts A–AL covered with the 21-aspect template  
- [x] Dependency diagram included  
- [x] E2E Morocco example + multi-turn + correction + clarify-before-search + fallback + voice example  
- [x] Versioning policy + compatibility matrix  
- [x] Out-of-scope list explicit  
- [x] No production code modified  
- [x] No runtime wiring / flag enablement  
- [x] No commit / branch / PR / tag created for this task  
- [ ] Human review / explicit approval before any implementation  

---

## 13. Out of scope (explicit)

- Sprint 89+ implementation work  
- Enabling `ai.brain.v1` or `ai.brain.v1.preview`  
- Introducing `ai.tie.v1`  
- Search Handoff **execution** / Option A soft-enrich continue coding  
- Provider Gateway calls / live inventory  
- Booking execution, payment capture, Tap/Tamara integration  
- STT/TTS provider selection and audio pipelines  
- Passport/identity collection flows  
- Parallel provider fabric  
- UI redesign / form wizards  
- Persisting long-term memory to Supabase (beyond contract semantics)  
- Emitting production OpenTelemetry  
- Any commit, branch, PR, or tag for this documentation task  

---

## 14. Ambiguities discovered (for later resolution — not blocking this spec)

| ID | Ambiguity | Interim rule |
| --- | --- | --- |
| A1 | Exact minimum field set for “sufficient information” per domain | Owned by MissingInformationPlanner + domain `buildQuery`; flights default to origin+destination+usable dates/flex; document per-domain tables at implementation time |
| A2 | Whether medium-confidence inferred dates can ever authorize search | **Default no**; only confirmed or high-confidence with AssumptionEngine explicit allowlist |
| A3 | Numeric confidence score vs level conflicts | **Level wins** |
| A4 | When Sprint 90 enables soft_enrich_continue vs keeping early_return_locked | Requires separate explicit approval; this contract only defines the decision shape |
| A5 | Long-term memory consent UX | Contract requires `retentionClass`; UX out of scope |
| A6 | Partial Arabic dialect normalization | EntityExtractor SHOULD normalize; exact gazetteer TBD |
| A7 | RankingConfig default weights | Configurable defaults TBD in implementation; no geo hardcoding |

---

## 15. Normative quick checklist

1. Model-agnostic contracts only.  
2. Envelope + confidence + errors shared.  
3. Clarify-before-search mandatory.  
4. Assumptions never silently become confirmed facts.  
5. Voice/text share Brain contracts; STT/TTS external.  
6. Search Handoff is decision-only until approved.  
7. Reuse `src/core/providerGateway` only — no parallel fabric.  
8. No booking/payment execution.  
9. No chain-of-thought in explainability or responses.  
10. Production behavior unchanged by this document alone.

---

**— End of Rahhal AI Contracts v1 —**
