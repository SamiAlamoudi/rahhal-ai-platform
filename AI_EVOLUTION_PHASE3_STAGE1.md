# AI Evolution — Phase 3 Stage 1

**Conversation Orchestrator**

| Item | Value |
|------|--------|
| Flag | `ai.conversation_orchestrator` |
| Default | **OFF** |
| Base | Phase 2 Stage 4 Runtime Coordinator |
| Scope | Additive conversation management only |

---

## Goal

Introduce a conversation layer above the Runtime Coordinator so Rahhal can detect intent, maintain memory, select only needed consultant stages, and produce a natural consultant reply — without changing production planning or Runtime Coordinator behavior.

---

## Architecture

```
User message
    → Conversation Orchestrator (flag ON)
        → intent detection
        → load / append memory
        → plan stages (intent map)
        → Runtime Coordinator (forced for this call)
            → selected consultant stages
            → Unified Consultant Response
        → conversational reply (confidence rules)
    → planTurn result (tripPlan preserved; reply may be conversational)
```

When the flag is **OFF**, `planTurn` behavior is identical to Phase 2 Stage 4 (and earlier) production paths.

---

## Deliverables

- `src/lib/agent/conversation/*` package  
- Feature registry entry `ai.conversation_orchestrator` (experimental, OFF)  
- Optional `conversationOrchestratorEnabled` on `createTravelAgentService`  
- `AgentProviderMeta.conversationOrchestrator` snapshot  
- Docs: `AI_CONVERSATION_ORCHESTRATOR.md`, this file  
- New tests only: `src/lib/__tests__/conversationOrchestrator.phase3.stage1.test.ts`

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
- Changing Runtime Coordinator source behavior  
- Merging PRs / rebasing prior evolution branches  
- Enabling the flag in production by default  

## Validation (Phase 3 Stage 1)

| Check | Result |
|-------|--------|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run arch:circular` | pass |
| `npm run test:run` | **2747** passed |

