# AI Agent Runtime & Tool Execution — Phase 6

**Status:** Additive · Feature flag **OFF** · Draft PR only · No UI redesign · No new reasoning layer  
**Continues from:** Phase 5 LLM Conversation Brain (#259)  
**Spine:** `chatEngine` → `travelAgentService.planTurn` (unchanged ownership)

Flag: `ai.agent_runtime` (default **OFF**)

## Mission

Connect existing AI modules into one **executable** runtime.  
Intelligence stays in Conversation Intelligence + LLM Brain.  
This package **executes** tools (mock), emits events, streams chunks, and syncs state.

## Reused modules (no duplication)

| Source | Modules |
|--------|---------|
| `conversationIntelligence` | ConversationMemory, IntentDetector, EntityExtractor, ReferenceResolver |
| `llmBrain` | ConversationPlanner, TravelReasoner, ToolDecisionEngine, ConversationState, ContextOptimizer, PromptBuilder, ResponseComposer |

## Package

`src/lib/agent/agentRuntime/`

| Module | Role |
|--------|------|
| `AgentRuntime` | Entry + session registry |
| `AgentSession` | Synced multi-turn state |
| `ExecutionContext` | Per-turn context + interrupt |
| `ExecutionPipeline` | Runtime pipeline |
| `ExecutionEvents` | Event bus |
| `ExecutionTrace` | Stage timing trace |
| `ExecutionResult` | Result builder |
| `tools/*Adapter` | Mock tool adapters |

## Runtime architecture

```text
User input
   |
   v
Conversation Memory (CI)
   |
   v
Intent + Entities + References (CI)
   |
   v
Travel Reasoner (llmBrain)
   |
   v
Tool Decision (llmBrain)
   |
   v
Execute Tool (mock adapters)
   |
   v
Update Memory
   |
   v
Compose Response (llmBrain)
   |
   v
Streaming chunks + events
```

## Tool lifecycle

```text
ready -> running -> completed
              \-> failed -> retry -> completed|failed
              \-> cancelled
              \-> timeout
```

Mock adapters: Flight · Hotel · Weather · Visa · Currency · Maps · Restaurant · Activities  
**No production API calls.**

## Event lifecycle

`ThinkingStarted` → `MemoryUpdated` → `ReasoningFinished` → `ToolStarted` → `ToolFinished` → `StreamingStarted` → `StreamingFinished`

Also: `Interrupted` / `Resumed`

## Interruption

`interruptAfter: 'thinking' | 'tool' | 'reasoning'` pauses the pipeline, syncs voice=`interrupted`, executionPhase=`paused`, and returns a natural continue prompt.

## State synchronization

`synced = { conversation, voice, executionPhase, memory }` kept coherent on `AgentSession`.

## Observability

`meta.agentRuntime.events` + `trace` + `durationMs` — debug only, no production UI.

## Execution example

> Find flights to Tokyo in October  
> → intent search_flights → FlightSearchAdapter (mock) → memory tool:flights → streamed consultant reply

## Integration rules

- Flag **OFF** → zero behavior change.  
- When ON: soft-merge requirements + attach `meta.agentRuntime`.  
- Does not replace Conversation Brain reply authorship or booking engines.  
- Distinct from Sprint 113 `ai.orchestrator`.  
- Draft only — do not merge.

## Test report

Suite: `src/lib/__tests__/agentRuntime.phase6.test.ts`  
Validate: `npm run lint`, `npm run typecheck`, `npm run arch:circular`, `npm run test:run`.
