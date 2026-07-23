# Quarantine list — Recovery Phase 1

Experimental stacks **deprecated and disconnected** from the default product path.
Code remains under `src/` (tests / flag-gated callers) until a later recovery phase deletes or migrates them.

| Module | Canonical replacement | Disconnect method |
|--------|----------------------|-------------------|
| `src/lib/chat/conversationExperience` (ConversationController) | `travelAgentService.planTurn` | Provider factory freeze |
| `src/lib/chat/chatgptExperience` | `travelAgentService.planTurn` | Provider factory freeze |
| `src/lib/aiOrchestrator` | `travelAgentService.planTurn` | Flag `brain.ai_orchestrator` deprecated + OFF |
| `src/lib/brain/integration` + Sprint 19–41 `brain.*` | `ai.rahhal_brain` via `planTurn` | Flags deprecated + OFF |
| `src/lib/agent/pipeline` + `streaming` + `ui/integration` Production chat | Legacy `ChatPage` + `chatEngine` | Routing freeze (always Legacy) |
| `src/lib/payments` (Sprint 34) | `src/lib/payment` | Flag deprecated; domain marked experimental |
| `src/lib/finance` (Sprint 41) | (none on checkout path) | Flag deprecated |
| `src/lib/agent/memory/*` (Sprint 112 MemoryRunner) | `src/lib/agent/memory.ts` slot rebuild | Flag `ai.memory_engine` OFF |
| `src/lib/brain/conversationMemory` / `brain/memory` | `agent/memory.ts` + `ai/preferences` | `brain.*` memory flags OFF |
| `src/utils/travelSession` as chat SoT | `chatService` + repositories | `/travel-conversation` → `/chat` redirect |
| `src/lib/voiceConversation` | `src/lib/chat/voice` | UI archived; flag OFF |
