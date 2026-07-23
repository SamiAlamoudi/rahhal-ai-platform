# DEPRECATED — Recovery Phase 1 (product path)

**Status:** Quarantined Sprint 112 Memory Engine.

**Sole memory pipeline on default `/chat` turns:** `src/lib/agent/memory.ts`
(`rebuildMemoryFromMessages`) plus preference seeding via `ai.persistent_memory`.

This package remains for flag-gated / test coverage. Flag `ai.memory_engine` stays OFF.
