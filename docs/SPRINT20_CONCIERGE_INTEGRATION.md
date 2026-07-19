# Sprint 20 — AI Travel Concierge Integration

Integrates the AI Travel Brain, Voice Conversation Foundation, and existing AI Concierge into one production-ready conversation flow.

## Non-goals (strict)

- No OpenAI / Azure / ElevenLabs / other external LLM or realtime APIs
- No fabricated natural-language Brain replies (plans remain structured tokens)
- No breaking changes when integration flags are OFF

## Architecture

```
User (text Chat OR speech → Chat voice / Sprint 18 voice)
        │
        ▼
travelAgentService.planTurn          voiceConversation.commitUserUtterance
        │                                      │
        ├──── brain.concierge ────┐            ├──── brain.voice ────┐
        │                         ▼            │                     ▼
        │              ConversationOrchestrator (shared Brain pipeline)
        │                         │
        │              BrainResponsePlan
        │                         │
        ├──── meta.brain ◄────────┘
        │
        ▼
Concierge.runTurn (existing) → Agent / tools / LLM (unchanged path)
```

## Integration points

| Surface | Behavior when flags ON |
|---------|------------------------|
| `travelAgentService.planTurn` | Runs Brain before Concierge/agent; attaches `meta.brain` |
| Chat text + Chat voice | Share `planTurn` → same Brain pipeline |
| Sprint 18 `createVoiceSession` | On transcript commit, runs Brain when `brain.voice`; sets `lastBrainPlan` |
| `brain.agent_handoff` | Merges Brain memory slots into agent `TripRequirements` |

## Feature flags (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_concierge` | `brain.concierge` | `brain.enabled` |
| `brain_agent_handoff` | `brain.agent_handoff` | `brain.concierge` |
| `brain_voice` | `brain.voice` | `brain.concierge` |

Parent `brain.enabled` (Sprint 19) remains OFF by default.

## Module

`src/lib/brain/integration.ts` — session cache, flag helpers, agent bridge, `runIntegratedBrainTurn`, `withBrainMeta`.

## Tests

`src/lib/__tests__/conciergeIntegration.sprint20.test.ts`

## Compatibility

- Flags OFF → identical to pre-Sprint-20 agent/concierge/voice behavior
- Sprints 9–19 packages remain intact
- Home mic (`useSpeechRecognition`) unchanged
