# Sprint 118 — Editable AI Conversation (Production)

**Type:** Additive edit layer (`src/lib/agent/editing`)  
**Reuses:** Execution Pipeline, Streaming (optional), Memory (via pipeline)

## Architecture

```
User edit utterance
    ↓
EditAnalyzer (intent)
    ↓
EditPlanner + AffectedStages
    ↓
PartialExecution → Execution Pipeline (stageOverrides)
    ↓
EditDiff + EditHistory + EditMetadata
    ↓
ConversationEditor result
```

Does **not** modify Execution Pipeline, Streaming Conversation, Memory Engine, Decision Engine, Trip Builder, Itinerary, or Concierge.

## Edit flow

1. Analyze natural-language edit (`change hotel`, budget, cabin, extend, remove city, …)
2. Identify what changed, stages to rerun / skip, estimated time
3. Patch trip snapshot + clear only affected offer pools
4. Rerun Execution Pipeline with `stageOverrides` (forced enabled for the wrap call only)
5. Emit before/after diff (confidence/budget/time deltas) and append history

## Feature flag

`ai.editable_conversation` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `{ enabled: false }` — legacy unchanged |
| ON | Incremental conversation edits |

## Verify

```bash
npm run editing:verify
```
