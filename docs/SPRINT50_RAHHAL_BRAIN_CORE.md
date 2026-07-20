# Sprint 50 — Rahhal Brain Core v1

Rahhal Brain Core is the **single decision layer** on the production `/chat` agent path. Existing engines (reasoning, clarification, preferences, tools) remain execution modules — the Brain orchestrates them.

## Pipeline

```
User message
  → Conversation Understanding
  → Intent Detection (multi-intent + confidence)
  → Memory Retrieval (preferences, prior picks)
  → Travel Reasoning (when discovery mode)
  → Internal Planning (never shown to user)
  → Decision (respond | clarify | continue)
  → Reflection (one pass)
  → Response Composer
  → Existing services (concierge, tools, booking)
```

## Package

`src/lib/brain/core/`

| Module | Role |
|--------|------|
| `rahhalBrain.ts` | Central orchestrator (`RahhalBrain`, `runRahhalBrainTurn`) |
| `conversationUnderstanding.ts` | Explicit / implicit / hidden intent + constraints |
| `intentEngine.ts` | Multi-intent classifier |
| `planningEngine.ts` | Internal module plan |
| `reflectionEngine.ts` | One-pass reply improvement |
| `responseComposer.ts` | Reasoning, recommendation, tradeoffs, warnings, next step |
| `pipeline.ts` | Module selection |
| `defaultPorts.ts` | Adapters to existing production engines |
| `ports.ts` | Dependency-inversion interfaces |

## Feature flag

- `ai.rahhal_brain` (default **ON**)
- Depends on `ai.concierge`, `ai.travel_reasoning`, `ai.smart_clarification`
- Distinct from experimental `brain.enabled` stack (default OFF)

## Integration

`travelAgentService.planTurn` delegates the intelligence path to `runRahhalBrainTurn` when the flag is on. Meta snapshot: `AgentProviderMeta.rahhalBrain`.

## Non-goals

- UI changes
- Enabling `brain.*` experimental stack
- Duplicating reasoning / clarification logic (delegates via ports)

## Tests

- `src/lib/__tests__/rahhalBrain.sprint50.test.ts`
