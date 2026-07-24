# AI Conversation Orchestrator — Phase 3 Stage 1

**Status:** Additive conversation layer · Flag `ai.conversation_orchestrator` **default OFF**  
**Freeze:** Production planning · Runtime Coordinator behavior · consultant engine internals remain untouched.

The Conversation Orchestrator sits **above** the Runtime Coordinator. It manages conversation only — never plans trips, scores destinations, or edits itineraries.

---

## 1. Responsibilities

1. Receive the user message  
2. Detect conversation intent  
3. Load current conversation state / memory  
4. Determine which consultant stages should run (never unnecessary stages)  
5. Invoke Runtime Coordinator with that stage subset  
6. Receive the Unified Consultant Response  
7. Generate the final conversational reply  

---

## 2. Intents

| Intent | Typical stages |
|--------|----------------|
| Destination discovery | traveler → destination → recommendation → unified |
| Trip planning | full mission set |
| Recommendation | traveler → destination → recommendation → unified |
| Budget optimization | traveler → strategy → recommendation → unified |
| Itinerary refinement | reflection → planning_graph → recommendation → unified |
| Compare destinations | traveler → destination → recommendation → unified |
| General travel advice | traveler → destination → unified |
| Clarification reply | reflection → traveler → unified (+ destination/recommendation when needed) |
| Continue previous | last intent’s map (fallback: reflection → traveler → recommendation → unified) |

---

## 3. Conversation rules

| Rule | Behavior |
|------|----------|
| No repeated questions | Track `answeredQuestions` + `pendingClarification` |
| One clarification at a time | At most one question per turn |
| High confidence | Answer immediately |
| Medium confidence | Answer first, then one optional follow-up |
| Low confidence | Exactly one clarification; never invent facts |
| Style | Natural senior travel consultant — no forms / questionnaires |

---

## 4. Memory (append-only)

Maintains: `conversationId`, `turnNumber`, `answeredQuestions`, `missingInformation`, `activeGoals`, `currentTrip`, `pendingClarification`, `conversationHistory`, `knownFacts`.

**Context policy:** only append; never overwrite prior user facts. Explicit user corrections win.

---

## 5. Reply formats

`executive` · `short` · `detailed` · `consultant`

---

## 6. Feature flag & planTurn

| Flag | Default | OFF | ON |
|------|---------|-----|----|
| `ai.conversation_orchestrator` | **OFF** | Production path unchanged | Conversation Orchestrator is the enrichment entry; invokes Runtime Coordinator with planned stages; may replace conversational `reply` text; never mutates `tripPlan` |

Depends on `ai.runtime_coordinator` in the FeatureRegistry (registry `isEnabled` requires the dependency). Force via `conversationOrchestratorEnabled: true` on `createTravelAgentService` for tests.

Precedence when multiple enrichment flags are considered:

```
conversation_orchestrator ON → Conversation Orchestrator
else runtime_coordinator ON → Runtime Coordinator
else pipeline/response ON → Stage 2/3 finalize
else → production result
```

---

## 7. Package layout

`src/lib/agent/conversation/`

| File | Role |
|------|------|
| `types.ts` | Contracts |
| `conversationRegistry.ts` | Flag + intent→stage map |
| `conversationIntent.ts` | Heuristic intent detection |
| `conversationState.ts` | Empty state / trip sync helpers |
| `conversationMemory.ts` | In-process append-only memory |
| `conversationContext.ts` | Context bag + fact extraction |
| `conversationPlanner.ts` | Stage selection |
| `conversationReply.ts` | Confidence-banded reply composition |
| `conversationOrchestrator.ts` | Entry + planTurn enrich |
| `index.ts` | Barrel |

---

## 8. What it never does

- Production planning / Decision Engine changes  
- Destination scoring or itinerary mutation  
- Runtime Coordinator internals  
- Network / LLM calls  
