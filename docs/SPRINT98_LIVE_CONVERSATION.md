# Sprint 98 — Live Conversation Experience

**Type:** Additive presentation metadata (`src/lib/agent/liveConversation`)  
**Feature flag:** `ai.live_conversation` (default **ON**)  
**Depends on (soft):** Sprint 96 Concierge Experience for delay mode hints only

## Goal

Make Rahhal conversation turns **streaming-ready** with session state, timeline DTOs, typing metadata, and progress events — without changing RahhalBrain, engines, providers, or booking logic.

## Architecture

```
planTurn (existing)
    ↓  (after reply authored)
runLiveConversationExperience  ← presentation only
    ↓
session + timeline + chunks + typing + events
    ↓
AgentProviderMeta.liveConversation
```

**Does not modify:** RahhalBrain, SearchPlanner, DecisionEngine, AdaptiveLearning, Price Intelligence, Dynamic Packages, Unified Trip, Booking Orchestrator, ConciergeComposer internals, providers.

Distinct from Sprint 32 `src/lib/chat/conversationExperience` (command/state machine) — this sprint adds live streaming metadata only.

## Session states

1. Thinking  
2. Searching  
3. Comparing  
4. Optimizing  
5. Final Recommendation  
6. Booking Ready  

## Conversation Timeline DTO

```ts
{
  currentStage,
  completedStages,
  remainingStages,
  estimatedProgress,
  stageLabels
}
```

## Streaming chunks (incremental)

Example sequence:

- Thinking…  
- Searching flights…  
- Comparing hotels…  
- Checking prices…  
- Building package…  
- Preparing recommendation…  

Each chunk: `sequence`, `stage`, `text`, `isFinal`, `progressPercent`.

## Typing metadata

- `responseDelay`  
- `estimatedRemaining`  
- `streamSequence`  

Concierge mode uses slightly shorter delays than legacy mode (presentation hint only).

## Progress events

`ConversationProgressEvent` with `ConversationStatus` + `ConversationPhase`:

- status: idle | in_progress | streaming | completed | interrupted | recovered | error  
- phase: intake | reasoning | discovery | evaluation | recommendation | booking  

## Added modules

| File | Role |
|------|------|
| `types.ts` | Contracts + stage labels/chunks |
| `session.ts` | Timeline, chunks, typing, events, session builder |
| `serializers.ts` | UI payload serializers |
| `feature.ts` | `ai.live_conversation` |
| `bridge.ts` | Agent entry `runLiveConversationExperience` |
| `index.ts` | Barrel |

## Integration

`travelAgentService.planTurn` attaches `meta.liveConversation` when the flag is enabled. No reply text rewriting; no engine calls.

## Tests

`src/lib/__tests__/liveConversation.sprint98.test.ts`

- legacy vs concierge mode  
- streaming metadata  
- progress events  
- empty / flag-off responses  
- interruption recovery  

```bash
npm run live-conversation:verify
```

## Compatibility

| Area | Status |
|------|--------|
| Engines / Booking / Providers | Untouched |
| Sprint 96 Concierge | Untouched (mode hint only) |
| Prior AgentProviderMeta | Additive `liveConversation?` |
| Circular imports | None |
