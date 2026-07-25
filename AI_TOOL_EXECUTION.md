# Tool Execution — Phase 6 Stage 7 (architecture)

**There is no tool execution in this stage.**

## Facade

| API | Behavior |
|-----|----------|
| `buildToolEngineBlueprint(options?)` | Always builds a pure blueprint |
| `tryBuildToolEngineBlueprint(options?)` | Returns `null` unless flag ON or `{ enabled: true }` |
| `assertToolEngineIsolation()` | Isolation flags + registry sizes |
| `ToolExecutionEngine.*` | Same facade methods |

## Isolation guarantees

`TOOL_ENGINE_ISOLATION` asserts **false** for:

- Production routes · OpenAI · Claude · Gemini · LLMs  
- Amadeus · Google APIs · Maps · Weather  
- Firebase · Supabase · Redis · Database · Storage · Runtime  
- Tool execution · Business logic  

## State machine (declarative)

`idle` → `discovering` → `resolving` → `validating_input` → `queued` → `dispatching` → `awaiting_result` → `validating_output` → `normalizing` → `ready` | `failed` → `closed`

Transitions are blueprint metadata only — no workers or timers.

## Retry / timeout / circuit

Hints only (`maxAttemptsHint: 0`, `timeoutMsHint: 0`, breaker `closed` with threshold `0`). No scheduling, no network.
