# Sprint 32 — AI Conversation Experience

Production-ready conversational interaction layer for Rahhal. Users plan trips in natural language — **no traditional booking forms**. Additive only: orchestrates Sprint 22–31 engines without duplicating planning, booking, or provider logic.

## Non-goals (strict)

- Do not rewrite AITripOrchestrator, UnifiedTravelPlanner, Memory, Search Aggregation, or providers
- Do not duplicate planning / booking / provider business logic
- Do not change Sprint 1–31 behavior when `brain.conversation_ui` is OFF
- Do not proactively ask for passport / nationality

## Architecture

```
User message
  → ConversationController
       ├─ ConversationState (incremental context)
       ├─ detectConversationCommand (cheaper / direct / upgrade / …)
       ├─ FollowUpQuestionEngine (reuses Unified + Memory follow-ups)
       ├─ UnifiedTravelPlanner.planTrip
       │     └─ AITripOrchestrator + Memory + Hotels + Flights + Aggregation
       ├─ ResponseComposer → structured response
       ├─ ConversationRenderer → markdown
       └─ StreamingResponse → ChatStreamChunk deltas
  → ChatProvider (conversation-ui) when flag ON
  → existing ChatPage / chatEngine (unchanged presentation)
```

| Module | Responsibility |
|--------|----------------|
| `ConversationController` | Turn orchestration |
| `ConversationSession` / `ConversationMessage` | Durable turn history |
| `ConversationState` | Incremental context + edits |
| `FollowUpQuestionEngine` | Minimal required questions |
| `ResponseComposer` | Structured Summary / Flights / Hotels / Itinerary / Cost / Confidence |
| `ConversationRenderer` | Markdown for the chat bubble |
| `StreamingResponse` | Delta streaming + meta on `done` |
| `ConversationEvents` | Observability hooks |

## User experience

- Natural conversation & incremental planning
- Follow-ups only when required (e.g. travelers after destination)
- Edit previous requests (“Make it cheaper”, “Business class”, …) without restarting
- Compare options / regenerate / continue session
- Structured assistant responses with suggested actions

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `conversation_ui` | `brain.conversation_ui` | `brain.unified_travel_planner` |

When ON, `createChatProvider()` may select `conversation-ui` (also via `VITE_CHAT_PROVIDER=conversation-ui`).

## Modules

`src/lib/chat/conversationExperience/`

## Integration

| Engine | Role |
|--------|------|
| UnifiedTravelPlanner | Produces ranked plans (Sprint 31) |
| AITripOrchestrator | Invoked inside planner (optional skip in tests) |
| Conversation Memory | Via planner/orchestrator working memory |
| Hotel / Flight foundations | Via planner provider search |
| Existing `chatEngine` | Unchanged; provider swap only |

## Tests

`src/lib/__tests__/conversationExperience.sprint32.test.ts`

Coverage: flags, command detection, follow-ups, Japan incremental flow, Morocco structured response, edits, compare, streaming, events, provider fallback, regression when flag OFF.
