# AI Multi-Turn Conversation Manager — Phase 3 Stage 2

**Status:** Additive conversation continuity layer · Flag `ai.multi_turn_conversation` **default OFF**  
**Freeze:** Production planning · Runtime Coordinator · Consultant Pipeline · Stage 1 orchestrator internals remain untouched.

The Multi-Turn Conversation Manager maintains natural dialogue across user messages. It is conversation management only — never plans trips, scores destinations, or edits itineraries.

---

## 1. Responsibilities

Maintain persistent dialogue state:

| Field | Role |
|-------|------|
| `conversationId` / `sessionId` | Session identity |
| `turnNumber` | Turn counter |
| `activeGoal` / `tripGoal` / `conversationTopic` | Focus |
| `conversationHistory` | Recent turns |
| `answeredQuestions` / `resolvedClarifications` | Never-ask-twice |
| `missingInformation` / `pendingClarification` | One clarification max |
| `travelerFacts` / `destinationFacts` / `strategyFacts` | Long-term extracted facts |
| `userCorrections` | Correction audit (user wins) |
| `conversationSummary` | Compressed older turns |

Memory layers: **short-term** · **working** · **summary** · **long-term facts**.

---

## 2. Turn events

Detects whether the user is:

- Continuing the current discussion  
- Starting a new trip  
- Changing destination / budget / dates / travelers  
- Correcting previous information  
- Asking a follow-up  
- Switching topics  
- Resuming unfinished work  

---

## 3. Conversation rules

| Rule | Behavior |
|------|----------|
| No repeated questions | Track answered + resolved + pending |
| One clarification | At most one question per turn |
| Preserve confirmed facts | Append-only; no destructive wipes of corrections log |
| Corrections win | Explicit user updates override prior values |
| High confidence | Never interrupt |
| Low confidence | Pause and clarify |
| Long chats | Auto-summarize and compress older turns |

---

## 4. Topics

`trip_planning` · `destination_research` · `budget_discussion` · `transportation` · `accommodation` · `activities` · `visa` · `weather` · `general_travel` · `recommendation`

---

## 5. Recovery

Supports: continue previous trip · resume unfinished planning · return to previous destination · resume pending clarification.

---

## 6. Feature flag & planTurn

| Flag | Default | OFF | ON |
|------|---------|-----|----|
| `ai.multi_turn_conversation` | **OFF** | Production path unchanged | Manager owns dialogue continuity; may update conversational `reply`; never mutates `tripPlan` |

Depends on `ai.conversation_orchestrator` in the FeatureRegistry. Force via `multiTurnConversationEnabled: true` on `createTravelAgentService`.

Precedence:

```
multi_turn_conversation ON → Multi-Turn Manager
  (optionally invokes Conversation Orchestrator when that flag is also ON)
else conversation_orchestrator ON → Conversation Orchestrator
else runtime_coordinator ON → Runtime Coordinator
else pipeline/response ON → Stage 2/3 finalize
else → production result
```

---

## 7. Package layout

Added under `src/lib/agent/conversation/`:

| File | Role |
|------|------|
| `memoryTypes.ts` | Multi-turn memory contracts |
| `conversationMemoryStore.ts` | In-process session store |
| `conversationSession.ts` | Session helpers |
| `topicDetector.ts` | Topic heuristics |
| `conversationTracker.ts` | Turn event detection |
| `clarificationManager.ts` | One-question clarification |
| `conversationSummarizer.ts` | Compress old turns |
| `conversationRecovery.ts` | Resume / continue |
| `multiTurnManager.ts` | Entry + planTurn enrich |

---

## 8. What it never does

- Production planning / Decision Engine changes  
- Runtime Coordinator or Consultant Pipeline changes  
- Destination scoring or itinerary mutation  
- Network / LLM calls  
