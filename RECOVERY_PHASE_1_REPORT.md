# Recovery Phase 1 Report — FREEZE & SIMPLIFY

**Date:** 2026-07-23  
**Basis:** `RECOVERY_AUDIT.md` (restored from prior audit run)  
**Mode:** Surgical simplification only — no new AI, voice, screens, prompts, brains, factories, or pipelines.

---

## 1. What was archived

Moved to `/archive` (disconnected from the product tree; **not deleted**):

| Former path | Why |
|-------------|-----|
| `src/components/brain/**` | Unmounted debug UI; zero page importers |
| `src/components/voice/**` | Sprint 18 chrome unused by routes |
| `src/hooks/useConversationBrain.ts` | Orphan |
| `src/hooks/useConversationMemory.ts` | Orphan |
| `src/hooks/useTravelContext.ts` | Orphan |
| `src/hooks/useVoiceConversation.ts` | Orphan |
| `src/hooks/useVoiceEvents.ts` | Orphan |
| `src/hooks/useVoiceState.ts` | Orphan |

See `archive/README.md`.

---

## 2. What became deprecated

Quarantined **in place** (code kept for tests / future deletion; product wiring disconnected):

| Area | Modules | Disconnect |
|------|---------|------------|
| Alternate chat UIs | `src/ui/integration/*`, flag `ui.production_integration` | Home/Chat always Legacy / AiHome |
| Alternate conversation providers | `conversationExperience`, `chatgptExperience` | `chatProviderFactory` always `travel-agent` (or `mock` in vitest) |
| Alternate turn owners | `aiOrchestrator`, ConversationController, agent pipeline/streaming | Flags deprecated + OFF; factory/routing ignore them |
| Experimental payments | `src/lib/payments`, `src/lib/finance` | `DEPRECATION.md`; sole payment = `lib/payment` |
| Parallel memory | `src/lib/agent/memory/*` (Sprint 112), brain memory flags | Sole memory = `agent/memory.ts` |
| Legacy intake route | `TravelConversation` page | `/travel-conversation` → `/chat` (state preserved) |
| Feature flags (museum) | Parallel `brain.*` / ChatGPT / production-integration / Sprint 112–118 / voice foundation | Lifecycle → `deprecated`, remain OFF |

Canonical freeze constants: `src/lib/recovery/freeze.ts`.  
Quarantine index: `archive/QUARANTINE.md`.

---

## 3. What remains active

| Concern | Active choice |
|---------|---------------|
| **One Conversation** | `chatEngine` → `travel-agent` provider |
| **One Turn Owner** | `travelAgentService.planTurn` |
| **One Chat UI** | `LegacyChatPage` on `/chat` |
| **One Home (default)** | `AiHomeExperience` (`ui.ai_home` ON) seeding `/chat` |
| **One Payment** | `src/lib/payment` (checkout) |
| **One Conversation Store** | `chatService` + repositories (+ `localChatStore` degraded/demo fallback of the same path) |
| **One Memory** | `src/lib/agent/memory.ts` (`rebuildMemoryFromMessages`) + preference seeding via `ai.persistent_memory` |
| **One Default Flow** | Home → `/chat` → chatEngine → planTurn → MessageBubble |
| **Voice** | Browser STT/TTS via `lib/chat/voice` + `VoiceComposer` as **voice input** into the same turn |

Production enrichers already on `planTurn` (concierge, RahhalBrain, clarification, etc.) remain — they are stages of the sole owner, not alternate owners.

---

## 4. Current architecture

```text
/ (AiHomeExperience)
  └─ seed → /chat

/chat (LegacyChatPage)          ← sole Chat UI
  → chatEngine.sendMessage
  → chatService (+ repos | localChatStore)
  → travel-agent provider       ← sole conversation system
  → travelAgentService.planTurn ← sole turn owner
       ├─ agent/memory.ts       ← sole memory rebuild
       ├─ preferences (persistent_memory)
       ├─ concierge / rahhal_brain / enrichers (same turn)
       └─ reply text → theatrical stream → MessageBubble

/checkout/* → lib/payment       ← sole payment

/travel-conversation → redirect /chat
/search → SearchWorkspace       ← search form only (not chat SoT)
```

Parallel stacks still exist on disk under `src/lib/**` for test coverage but are **not** selected by product routing or default provider selection.

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Bookmarks to `/travel-conversation` | Redirect forwards `tripText` / `initialPrompt` into `/chat` |
| Tests that enabled `ui.production_integration` expecting ChatPage swap | Screens still importable; routing no longer swaps — suites that only mount screens remain green |
| Enabling frozen flags via `setEnabled` in staging | Wiring ignores the dangerous ones (Chat/Home/factory); flag enable alone cannot resurrect Production chat |
| Quarantined packages still in bundle graph | Acceptable for Phase 1; physical delete is Phase 2 |
| `/search` still a second intake surface | Intentionally kept as search form; not declared chat SoT. Further thinning is Phase 3 |
| Docs (`README`, sprint notes) still mention dual UIs | Report is SoT for Phase 1; doc sweep deferred |

---

## 6. Next phase recommendation

**Recovery Phase 2 — Delete dead weight (safe deletion pass)**

Only after confirming no production dependency:

1. Delete `/archive` contents from the repo history plan (or keep archive permanently outside `src/`).
2. Remove quarantined packages that tests no longer need — or move test-only trees fully under `/archive` with opt-in vitest projects.
3. Physically remove `TravelConversation.tsx` once redirect has soaked.
4. Cap / delete deprecated FeatureIds that nothing imports.
5. Do **not** start Phase 3 (SoT migration of `travelSession` search) until Phase 2 deletion is clean.

**Do not** begin Phase 5 concierge/realtime work yet.

---

## Success criteria checklist

| Criterion | Status |
|-----------|--------|
| One Conversation | Done — travel-agent |
| One Turn Owner | Done — `planTurn` |
| One Chat UI | Done — LegacyChatPage |
| One Memory | Done — `agent/memory.ts` |
| One Payment | Done — `lib/payment` |
| One Default Flow | Done — Home → `/chat` → planTurn |
| Less architectural complexity | Done — parallel paths disconnected + orphans archived |
| No permanent delete of uncertain production code | Done — archive / deprecate first |

---

*End of Recovery Phase 1 report.*
