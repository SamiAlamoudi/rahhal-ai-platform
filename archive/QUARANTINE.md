# Quarantine list — Recovery

Experimental stacks **deprecated and disconnected** from the default product path.

## Deleted in Sprint 80 P1-1 (museum deletion)

| Former path | Replacement |
|-------------|-------------|
| `archive/src/components/brain/**` | (none — debug UI) |
| `archive/src/components/voice/**` | `src/components/chat/VoiceComposer` + `src/lib/chat/voice` |
| `archive/src/hooks/useConversation*` / `useVoice*` / `useTravelContext` | (none — orphans) |
| `src/ui/integration/**` | `LegacyChatPage` / Home AI experience |
| `src/lib/uiIntegration/**` | (none — Production UI bridge) |
| `src/lib/agent/pipeline/**` | `travelAgentService.planTurn` |
| `src/lib/agent/streaming/**` | chatEngine deltas |
| `src/lib/agent/editing/**` | (none on default path) |
| `src/lib/agent/orchestrator/**` (Sprint 113) | `travelAgentService.planTurn` |
| `src/lib/agent/memory/**` (Sprint 112 MemoryRunner) | `src/lib/agent/memory.ts` slot rebuild |

Frozen feature flags for the deleted packs remain registered **OFF** in
`RECOVERY_FROZEN_OFF_FLAGS` so enablement cannot resurrect wiring.

## Still quarantined in-place (not deleted this PR)

| Module | Canonical replacement | Why kept |
|--------|----------------------|----------|
| `src/lib/chat/conversationExperience` (ConversationController) | `travelAgentService.planTurn` | Types/UI helpers + harness tests |
| `src/lib/chat/chatgptExperience` | planTurn | Still used by LegacyChatPage session UI |
| `src/lib/aiOrchestrator` | planTurn | Controller / finance harness |
| `src/lib/brain/**` (incl. integration enrichers) | `ai.rahhal_brain` via planTurn | On planTurn enricher path |
| `src/lib/payments` (Sprint 34) | `src/lib/payment` | bookingBridge on Legacy |
| `src/lib/finance` (Sprint 41) | (none on checkout) | Controller harness |
| `src/utils/travelSession` | chatService + repositories | `/search` intake (Phase 3) |

## Voice (do not delete)

Production voice remains `src/lib/chat/voice/**` (post-#313). Not part of the museum.
