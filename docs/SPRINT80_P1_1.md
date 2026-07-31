# Sprint 80 P1-1 — Museum deletion (Recovery Phase 2 slice)

**Baseline:** `main` @ `82a7e8d` (PR #313)  
**Branch:** `cursor/sprint80-p1-1-museum-deletion-71ec`

## Goal

Physically remove disconnected Production-parallel stacks and archive orphans without
touching the conversation-first spine or the #313 voice stack.

## Deleted

- `archive/src/**` (orphan brain/voice chrome + hooks)
- `src/ui/integration/**`, `src/lib/uiIntegration/**`
- `src/lib/agent/{pipeline,streaming,editing,orchestrator,memory}/**`
  - **Kept:** `src/lib/agent/memory.ts` (slot rebuild on planTurn)
- Dedicated tests: memory.112, orchestrator.113, pipeline.115, streaming.116,
  editing.118, uiIntegration.120, premiumHome.121

## Preserved

- `/chat` → LegacyChatPage → chatEngine → planTurn
- All `src/lib/chat/voice/**` and Home Realtime voice from #313
- Frozen OFF flags in `RECOVERY_FROZEN_OFF_FLAGS` (registry entries remain)

## Deferred (later P1 / Phase 2 follow-ups)

ConversationController / aiOrchestrator / finance / payments / brain enrichers /
travelSession search SoT.
