# Sprint 48 — Persistent Preference Memory

Make “never ask twice” survive across chat sessions.

## Product rule

> Remember user preferences forever.

Sprint 45–46 already seed/learn preferences in-process. Sprint 48 makes those profiles **durable**.

## What is remembered

| Slot | Source |
|------|--------|
| Budget amount / currency / style | Learned from turns |
| Weather preference | Learned / seeded |
| Traveler type & party size | Learned / seeded |
| Hotel preference | Learned / seeded |
| Interests | Learned / seeded |
| Favorite destinations | Locked destinations appended (max 12) |

Taste profiles only — **no passport / visa / payment PII**.

## Architecture

```
planTurn
  → seedRequirementsFromPreferences(getPreferenceEngine())
  → … clarify / reason / plan …
  → learnPreferencesFromRequirements(...)

getPreferenceEngine()
  → InMemoryPreferenceEngine + PreferenceStorage (localStorage when flag ON)
```

| Module | Path |
|--------|------|
| Storage adapters | `src/lib/ai/preferences/preferenceStorage.ts` |
| Engine persistence | `src/lib/ai/preferences/preferenceEngine.ts` |
| Learn destinations | `src/lib/agent/reasoning/preferenceBridge.ts` |

## Feature flag (default **ON**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `persistent_memory` | `ai.persistent_memory` | `ai.personalization` |

When `localStorage` is unavailable (SSR/CI), the engine stays memory-only — same API.

## Privacy

Respects `PreferenceEngine` personalization gate (`personalizationAllowed`). Settings `privacy_personalization` continues to gate product analytics/personalization surfaces separately.

## Tests

`src/lib/__tests__/persistentMemory.sprint48.test.ts`
