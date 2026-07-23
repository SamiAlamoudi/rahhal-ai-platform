# DEPRECATED — Recovery Phase 1 (product routing)

**Status:** Quarantined Premium / Production integration screens (Sprint 119–121).

**Sole Chat UI:** `src/pages/ChatPage.tsx` → `LegacyChatPage`.

`Home.tsx` and `ChatPage.tsx` no longer branch on `ui.production_integration`.
These screens remain exportable for unit tests only.
