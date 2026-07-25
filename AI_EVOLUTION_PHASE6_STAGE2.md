# AI Evolution — Phase 6 Stage 2

## AI Conversation Orchestrator (architecture)

| Field | Value |
|-------|-------|
| Flag | `brain.conversation_orchestrator` |
| Default | **OFF** |
| Depends on | `ui.integration_foundation` |
| Package | `src/lib/orchestration/conversationOrchestrator/` |
| Distinct from | Phase 3 `ai.conversation_orchestrator` |
| LLM / API / Runtime / Production | **Not wired** |

See `AI_CONVERSATION_ORCHESTRATOR.md`, `AI_CONTEXT_PIPELINE.md`, `AI_REASONING_PIPELINE.md`, `AI_SESSION_ARCHITECTURE.md`.

## Validation

| Command | Result |
|---------|--------|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run arch:circular` | Pass |
| `npm run test:run` | Pass — **2873** tests (255 files) |

Draft PR: https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/236  
Do not merge.
