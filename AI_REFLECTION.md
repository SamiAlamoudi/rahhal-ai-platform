# AI Reflection — Consultant Reflection Layer (Evolution Sprint 2)

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.consultant_reflection` **default OFF**  
**Depends on:** Sprint 1 `ai.consultant_reasoning` (library import only; modules not modified)  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Production Authority · `planTurn` · Consultant Reasoning module sources remain untouched.

Rahhal must **observe → re-score → refine** as the conversation evolves — never restart consultant reasoning from scratch when only part of the graph changed.

---

## 1. Memory Model

```
ReflectionSession
├── turns[]              ConversationMemory (append-only user/consultant turns + slotDelta + evidence)
├── state                TravelerState (merged KnownSlots + evolving priorities)
├── nodes                CachedReasoningNodes (intent…explanation) — reuse when clean
├── confidenceHistory[]  ConfidenceTracker points (overall + per-node)
├── assumptions[]        AssumptionTracker (active | confirmed | invalidated)
├── recommendations[]    RecommendationRecord revisions (full audit fields)
├── decisionHistory[]    DecisionHistory entries (confidence before/after + refreshed nodes)
├── clarificationQueue[] ClarificationPriority (re-ranked missing data)
└── alternatives[]       AlternativeExplorer labels (no live inventory)
```

### Slot memory

- Slots merge **incrementally** (`mergeSlots`) — later turns overwrite only provided keys; interests union.
- Extraction is conservative regex/heuristic (`extractSlotDeltaFromText`) — never invents amounts/cities without cues.
- Callers may pass `knownDelta` for explicit confirmations.

### Recommendation record (every revision)

| Field | Purpose |
|-------|---------|
| `confidence` | 0–1 at decision time |
| `timestamp` | ISO time |
| `evidence` | Turn / slot evidence strings |
| `constraints` | Hard + soft constraint labels |
| `tradeoffs` | Trade-offs at this revision |
| `assumptions` | Active assumption texts |
| `missingData` | Outstanding gaps |
| `reasonForChange` | Why this revision exists |
| + why / whyNot / alternative / risk / expectedValue | Consultant answers |

---

## 2. Reflection Pipeline

```
reflectTurn(session, { userText, knownDelta?, locale?, now? })
        │
        ▼
 ConversationMemory.appendUserTurn  →  slotDelta + evidence
        │
        ▼
 TravelerState.applyTurnToState     →  merged slots + priorities
        │
        ▼
 changedSlotKeys + NodeInvalidation.computeDirtyNodes
        │
        ├─ dirty  → refreshDirtyNodes (call Sprint 1 analyzers ONLY for dirty ids)
        └─ reused → keep CachedReasoningNodes entries
        │
        ▼
 AssumptionTracker invalidate + sync
        │
        ▼
 RecommendationRefiner → RecommendationRecord
 ConfidenceTracker snapshot
 DecisionHistory append
 ClarificationPriority rebuild
 AlternativeExplorer update
 ExplanationRevision revise (AR/EN templates)
```

**Gate:** `tryReflectTurn` returns `null` when `ai.consultant_reflection` is OFF (unless `enabled: true`).

**Entry:** `ReflectionPipeline.createSession` / `.reflect` / `.tryReflect`.

---

## 3. Decision Loop

1. **Observe** — new traveler text + optional explicit slots.
2. **Remember** — append turn; merge state; do not wipe history.
3. **Invalidate** — map changed slots → dirty reasoning nodes (+ dependents).
4. **Re-score** — refresh dirty nodes via Sprint 1 functions (import-only).
5. **Refine** — new `RecommendationRecord` with `reasonForChange`; keep prior records.
6. **Explain** — revise AR/EN explanation; attach `changeNote` when revised.
7. **Prioritize** — re-rank clarification queue from remaining `missingData`.

Cold start (empty cache) refreshes all nine nodes once. Subsequent turns refresh **only** affected nodes.

### Slot → seed nodes (then dependents expand)

| Slot change | Seed nodes |
|-------------|------------|
| destination | destination, constraints, risk |
| budgetAmount | budget, constraints, value |
| durationDays | constraints, budget, value |
| tripPurpose | intent, profile, destination, value, risk |
| interests | profile, destination, value |
| adults/children | profile, constraints, risk |
| monthHint | constraints, destination, risk |
| text-only | intent (light), then recommendation/explanation if anything dirty |

---

## 4. Future Online Learning hooks

Extension points — **not implemented** in Sprint 2 (still CPU-only, no network):

| Hook | Intent |
|------|--------|
| `LearningSignalPort.record(session, outcome)` | Later: accept booking / reject / refine outcomes |
| Preference weight updates | Feed durable preference memory without rewriting Brain |
| Bandit / ranker feedback | Adjust AlternativeExplorer ordering from anonymized outcomes |
| Assumption priors | Warm-start AssumptionTracker from traveler profile store |
| Cross-session resume | Serialize `ReflectionSession` to trip memory (ops-owned persistence) |

All hooks must remain **behind feature flags**, additive, and must not call LLMs from this layer unless a future sprint explicitly introduces a polish port.

---

## 5. Performance / production impact

| Concern | Sprint 2 |
|---------|----------|
| Network / API / LLM | **None** |
| planTurn wiring | **None** |
| Default flag | **OFF** |
| Production chat path | **Zero** impact while unwired |
| CPU | Regex + in-memory graph refresh |

---

## 6. Tests

`src/lib/__tests__/consultantReflection.sprint2.test.ts`

- Feature gate · memory evolution · incremental reuse · recommendation fields  
- Arabic + English multi-turn conversations · revision / decision history  
- Regression: no planTurn export; Sprint 1 still callable; history preserved
