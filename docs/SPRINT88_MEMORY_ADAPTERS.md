# Sprint 88 Task 3 — Memory Adapters

**Status:** Complete (awaiting review before next task)  
**Prior checkpoint:** `sprint88-task1-complete` · Task 2 contracts  
**Flags:** `ai.brain.v1` OFF · `ai.brain.v1.preview` OFF  

## Scope

In-memory adapters only — **not** wired into BrainRouter, ConversationManager, or `planTurn`.

| Adapter | Role |
| --- | --- |
| `WorkingMemoryAdapter` | Incremental slots ↔ `AgentMemory` + provenance |
| `UserPreferenceAdapter` | Preference snapshot + soft defaults (empty slots only) |
| `TripMemoryAdapter` | Trip snapshot + invalidate on new trip / planId |
| Provenance interfaces | `MemoryFactProvenance` / conflict resolution |

## Non-goals (enforced)

- No Supabase / DB writes / persistence implementation  
- No Brain execution changes  
- No feature-flag enablement  
- No Search Handoff / provider calls  
- AgentMemory remains source of truth  

## Modules

```text
src/lib/brain/v1/preview/memory/
  provenance.ts
  WorkingMemoryAdapter.ts
  UserPreferenceAdapter.ts
  TripMemoryAdapter.ts
  index.ts
```

## Verify

```bash
npm run test:run -- src/lib/__tests__/sprint88.memoryAdapters.task3.test.ts
npm run test:run
```
