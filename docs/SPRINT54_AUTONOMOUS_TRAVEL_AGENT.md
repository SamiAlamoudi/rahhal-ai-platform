# Sprint 54 — Autonomous Travel Agent

Transforms Rahhal from a conversational assistant into a goal-oriented autonomous travel agent — without changing Conversation Brain behavior.

## Architecture

```
User message
  → Travel Intelligence (extract / memory / concierge / reasoning)
  → Autonomous Agent (feature flag ai.autonomous_agent)
       Goal Engine → Execution Plan → Tool Planner (retry + recovery)
       → progress events (Thinking / Searching / Comparing / Booking / Completed)
  → Conversation Brain (displayText + spokenText)
  → Chat UI + Voice
```

## Capabilities

1. **Goal Engine** — long-running travel objective across turns until completed
2. **Multi-step execution plan** — pending / completed task tracking
3. **Autonomous continuation** — when enough information exists; at most one clarification
4. **Tool Planner** — sequential tools, retries, alternative-provider recovery
5. **Background jobs** — async worker with progress pub/sub
6. **Structured progress** — Thinking / Searching / Comparing / Booking / Completed
7. **Recovery** — never terminate the conversation because of a single tool failure
8. **State machine** — IDLE → UNDERSTANDING → PLANNING → EXECUTING → WAITING_PROVIDER → RECOVERING → COMPLETE / FAILED
9. **Observability** — goal, active task, provider, retry count, duration, outcome

## Modules

| Path | Role |
|------|------|
| `src/lib/agent/autonomous/goalEngine.ts` | Goal persistence |
| `src/lib/agent/autonomous/executionPlan.ts` | Multi-step task plan |
| `src/lib/agent/autonomous/stateMachine.ts` | Explicit execution states |
| `src/lib/agent/autonomous/toolPlanner.ts` | Tool order, retry, recovery |
| `src/lib/agent/autonomous/runner.ts` | Turn orchestration |
| `src/lib/agent/autonomous/backgroundJobs.ts` | Async job + progress stream |
| `src/lib/agent/autonomous/observability.ts` | Structured logs |

## Feature flag

`ai.autonomous_agent` (beta, default ON). Override in tests via `autonomousAgentEnabled`.

## Non-goals

- Does **not** author traveler-facing prose (Conversation Brain remains sole author)
- Does **not** introduce hardcoded reply templates
- Does **not** break existing `planTurn` / `ChatProvider` APIs (additive only)
