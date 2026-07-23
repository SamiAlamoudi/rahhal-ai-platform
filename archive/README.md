# Archive — Recovery Phase 1

Modules moved here are **disconnected from the product tree**. They are preserved for reference, not deleted.

**Do not import from `/archive` in application code.**

## Archived in Phase 1 (2026-07-23)

| Former path | Reason |
|-------------|--------|
| `src/components/brain/**` | Unmounted debug UI; no page importers |
| `src/components/voice/**` | Sprint 18 chrome unused by routes (production voice = `src/components/chat/VoiceComposer` + `src/lib/chat/voice`) |
| `src/hooks/useConversationBrain.ts` | Orphan hook |
| `src/hooks/useConversationMemory.ts` | Orphan hook |
| `src/hooks/useTravelContext.ts` | Orphan hook |
| `src/hooks/useVoiceConversation.ts` | Orphan hook |
| `src/hooks/useVoiceEvents.ts` | Orphan hook |
| `src/hooks/useVoiceState.ts` | Orphan hook |

## Quarantined in-place (not moved — still imported by tests / flag chains)

See `archive/QUARANTINE.md` and per-package `DEPRECATION.md` files under `src/lib/`.

These stay in `src/` so unit tests and TypeScript graph remain green, but they are **not** on the default production path.
