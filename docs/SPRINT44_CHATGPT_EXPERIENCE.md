# Sprint 44 — ChatGPT-like Conversation Experience

Make Rahhal’s conversation feel as close as possible to ChatGPT Chat and ChatGPT Voice.

**Strict non-goals:** no new hotels, flights, suppliers, payments, or other travel engines. Orchestrate existing chat/voice/memory paths only.

## Primary goal

Users should feel they are talking to a real AI assistant — smooth, fast, contextual, interruptible, and natural.

## Architecture

```
ChatPage / MessageBubble / VoiceComposer
  → chatProviderFactory
       └─ chatgpt-experience (when ui.chatgpt_experience ON)
            └─ ChatGptExperienceOrchestrator
                 ├─ Memory Manager (Sprint 28 MemoryContextEngine + rolling window)
                 ├─ Intent Understanding (before reply)
                 ├─ Response Planner (internal plan — never user-facing)
                 ├─ Tool Decision Engine (route only; no new travel logic)
                 ├─ Natural language + smart follow-ups
                 ├─ Experience state machine (Listening… → Done)
                 └─ Existing conversation-ui provider for tool work
```

| Module | Responsibility |
|--------|----------------|
| `memoryManager.ts` | Previous messages, preferences, destinations, budgets, travel style, companions, unfinished slots, tool results; rolling window + summaries |
| `intentUnderstanding.ts` | Classify intent before generation |
| `responsePlanner.ts` | Internal plan + tool decision |
| `experienceOrchestrator.ts` | Intent → plan → optional tools → streamed natural reply |
| `conversationStates.ts` | Listening / Understanding / Thinking / Using tools / Searching / Generating / Responding / Speaking / Done |
| `contextRecovery.ts` | Refresh-safe draft, modality, voice mode, pins |
| `errorRecovery.ts` | Automatic tool retry + natural failure copy |
| `experienceLogger.ts` | Stage logs + timing (mic, STT, intent, plan, tools, LLM, stream, TTS, persistence) |
| `naturalLanguage.ts` | Conversational openers + smart follow-ups |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `chatgpt_experience` | `ui.chatgpt_experience` | `ui.conversation_experience` |

When OFF, provider selection falls through to conversation-ui / travel-agent as before.

## Capabilities

1. **Conversation memory** — rolling context; summarize long threads via Sprint 28 engine; never drop preferences/tool results from the window.
2. **Intent first** — Book Flight, Search Hotels, Create Itinerary, Travel Advice, Visa, General Chat, Follow-up, Tool Result, Small Talk, Unknown (+ weather/pricing routing labels).
3. **Response planner** — internal steps only (`understand_request` → … → `generate_response`).
4. **Tool decision** — greetings/small talk skip tools; weather/hotels/flights/pricing route to existing tools when needed; clarifying follow-ups defer tools (ChatGPT-style).
5. **Streaming** — first tokens immediately; cancellation / interruption / regeneration supported.
6. **Voice** — continuous listening, silence timeout, interrupt while speaking, hands-free + push-to-talk (production stabilization voice session).
7. **UX states** — Listening… Understanding… Thinking… Using tools… Searching… Generating… Responding… Speaking… Done.
8. **Natural conversation** — context-aware wording; follow-ups only when they improve the turn.
9. **Error recovery** — retry tools; explain naturally; keep UI unstuck.
10. **Context recovery** — conversation id, draft, stream-friendly UI, modality, attachments path, voice mode/locale, pinned conversations.
11. **ChatGPT-quality UX** — typing indicator, streaming cursor, smart auto-scroll, copy, regenerate, stop, continue, edit previous message, retry, timestamps, rename, pin, search.
12. **Performance** — TTFT-oriented streaming, lazy/virtualized message list (Sprint 42), coalesced deltas.

## Intents

`book_flight` · `search_hotels` · `create_itinerary` · `travel_advice` · `visa_question` · `general_chat` · `follow_up` · `tool_result` · `small_talk` · `unknown` · `weather` · `pricing`

## Modules

- `src/lib/chat/chatgptExperience/`
- Wired from `chatProviderFactory`, `chatService`, `ChatPage`, `MessageBubble`, `ConversationSidebar`

## Tests

`src/lib/__tests__/chatgptExperience.sprint44.test.ts`
