# AI Evolution — Phase 7 Stage 12

## AI Conversation Brain Orchestrator (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.conversation_brain` |
| Default | **OFF** |
| Depends on | `brain.booking_orchestrator` |
| Package | `src/lib/orchestration/conversationBrain/` |
| Distinct from | `agent/conversationBrain` · `brain.conversation_orchestrator` · `ai.conversation_orchestrator` |
| Engine invocation / LLM / HTTP / Providers / Booking / UI / DB | **Not wired** |

See `AI_CONVERSATION_BRAIN.md`, `AI_CONVERSATION_PIPELINE.md`, `AI_CONVERSATION_FLOW.md`, `AI_CONVERSATION_SCHEMA.md`, `AI_CONVERSATION_VALIDATION.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass — **2949** tests (274 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/255  
Do not merge.
