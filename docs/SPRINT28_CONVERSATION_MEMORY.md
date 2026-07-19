# Sprint 28 — Conversation Memory & Context Engine

Conversation-first memory layer for Rahhal. Builds on Sprint 19 slot memory and Sprint 27 `AITripOrchestrator` without replacing planning, search, booking, or provider engines.

## Non-goals (strict)

- Do not create a new Trip Planning / Search / Booking / Provider engine
- Do not enable live HTTP by default
- Do not change Sprint 1–27 behavior when `brain.context_memory` is OFF
- Do not proactively ask for passport or nationality
- Do not store passport numbers or loyalty membership IDs in long-term preference storage

## Architecture

```
User turn
  → MemoryExtractor (structured prefs from natural language)
  → ConversationMemoryService (short-term session + TTL)
  → UserPreferenceStore (long-term prefs, privacy-gated)
  → ContextAssembler (current + previous + long-term → working memory)
  → ConversationSummarizer (when chats grow long)
  → Minimum follow-up questions (core slots only; never passport)
  → AITripOrchestrator (Sprint 27) seeds Brain pipeline from working memory
```

| Component | Responsibility |
|-----------|----------------|
| `ConversationMemoryService` | Short-term session memory, turn history, TTL, sensitive-field expiry |
| `UserPreferenceStore` | Long-term travel preference profile per `userId` |
| `MemoryExtractor` | Rule-based extraction of airlines, hotels, cabin, budget, travelers, family, seats, meals, accessibility, loyalty, visa, explicit nationality |
| `ContextAssembler` | Merge current conversation + previous state + stored prefs |
| `ConversationSummarizer` | Privacy-safe digests for long chats + recent-turn window |
| `MemoryContextEngine` | Facade used by the orchestrator |

## Remembered preferences

| Preference | Short-term | Long-term | Notes |
|------------|------------|-----------|-------|
| Preferred airlines | yes | yes | |
| Preferred hotel brands | yes | yes | |
| Cabin class | yes | yes | |
| Budget range | yes | yes (max + currency) | |
| Traveler count | yes | yes (typical) | |
| Family members | yes | yes (labels/relations only) | |
| Passport / nationality | yes | nationality only | **Only when explicitly provided** |
| Visa status | yes | yes | |
| Seat preferences | yes | yes | |
| Meal preferences | yes | yes | |
| Accessibility | yes | yes | |
| Loyalty programs | yes (may hold member # briefly) | **names only** | Member numbers stripped long-term + after sensitive TTL |

## Privacy & expiration

- Short-term session TTL: **24h** (configurable)
- Sensitive short-term fields (passport/nationality, loyalty numbers): **2h** from last update
- Long-term profile TTL: **180d** (configurable; `null` disables)
- Personalization gate: `UserPreferenceStore({ personalizationAllowed: false })` blocks reads/writes
- Summaries / public sanitizers never emit raw membership numbers or inferred nationality

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_context_memory` | `brain.context_memory` | `brain.trip_orchestrator` |

## Modules

`src/lib/brain/memory/`

## Integration

- `AITripOrchestrator.runTurn` runs `MemoryContextEngine` when `brain.context_memory` (or `options.contextMemory`) is on, then seeds the Brain conversation session from assembled working memory.
- Result attaches `AITripOrchestratorTurnResult.memory` and `AgentProviderMeta.brain.memory` / `memoryFollowUps` / `memorySummary`.
- When the flag is OFF, Sprint 27 behavior is unchanged (`memory: null`).

## Tests

`src/lib/__tests__/conversationMemory.sprint28.test.ts`

Coverage: unit extraction, short-term persistence, long-term privacy, follow-ups, summarization, context reconstruction, orchestrator integration, flag-off compatibility.
