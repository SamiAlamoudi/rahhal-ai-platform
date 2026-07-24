# AI Evolution — Phase 3 Stage 2

**Multi-Turn Conversation Manager**

| Item | Value |
|------|--------|
| Flag | `ai.multi_turn_conversation` |
| Default | **OFF** |
| Base | Phase 3 Stage 1 Conversation Orchestrator |
| Scope | Additive dialogue continuity only |

---

## Goal

Allow Rahhal AI to maintain natural multi-turn conversations with persistent memory, topic awareness, clarification discipline, summarization, and recovery — without changing planning engines or Runtime Coordinator / Consultant Pipeline behavior.

---

## Architecture

```
User message
    → Multi-Turn Conversation Manager (flag ON)
        → load session / short-term + working + long-term memory
        → topic detection + turn event tracking
        → append facts (corrections win)
        → clarification decision (≤1 question)
        → recovery (resume / continue)
        → optional Conversation Orchestrator (if its flag ON)
        → summarize / compress when history is long
        → natural reply + updated session
    → planTurn result (tripPlan preserved)
```

When the flag is **OFF**, `planTurn` behavior matches Phase 3 Stage 1 / Phase 2 paths.

---

## Deliverables

- New files under `src/lib/agent/conversation/` (manager, session, store, summarizer, topic, clarification, recovery, tracker, memoryTypes)
- Feature registry entry `ai.multi_turn_conversation` (experimental, OFF)
- Optional `multiTurnConversationEnabled` on `createTravelAgentService`
- `AgentProviderMeta.multiTurnConversation` snapshot
- Docs: `AI_MULTI_TURN_CONVERSATION.md`, this file
- New tests only: `src/lib/__tests__/multiTurnConversation.phase3.stage2.test.ts`

---

## Validation

```
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

---

## Non-goals

- Modifying Decision Engine / Planning Draft / Conversation Brain / Smart Clarification  
- Changing Runtime Coordinator or Consultant Pipeline sources  
- Merging PRs / rebasing prior evolution branches  
- Enabling the flag in production by default  
