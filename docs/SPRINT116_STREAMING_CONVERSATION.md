# Sprint 116 — AI Streaming Conversation Experience (Production)

**Type:** Additive streaming layer (`src/lib/agent/streaming`)  
**Wraps:** Sprint 115 Unified AI Execution Pipeline (public adapters only)

## Architecture

```
User request
    ↓
StreamingConversation (feature flag)
    ↓
StreamingRunner wraps stage adapters
    ↓
Execution Pipeline (unchanged)
    ↓
Memory → Search → Flights → Hotels → Decision → Trip Builder
  → Itinerary → Response Composer → Concierge → Final
```

Each stage emits streaming events: `started` → `progress` (0/25/50/75/100) → `completed` | `warning` | `error` | `skipped`.

No modifications to Execution Pipeline, Orchestrator, Decision Engine, Providers, Memory, Trip Builder, Itinerary, or Concierge.

## Streaming flow

1. Feature flag gate (`ai.streaming_conversation`)
2. Wrap default pipeline adapters with event emitters
3. Run `runUnifiedExecutionPipeline` with wrapped adapters (`enabled: true` for the wrapped call only)
4. Maintain timeline + progress tracker + metrics
5. Return `StreamingConversationResult` with transcript lines for progressive UX

## Feature flag

`ai.streaming_conversation` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `{ enabled: false }` — legacy unchanged |
| ON | Streaming layer wraps Execution Pipeline |

## Verify

```bash
npm run streaming:verify
```
