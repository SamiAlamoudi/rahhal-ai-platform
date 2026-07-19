# Sprint 16 — AI Home Experience (Conversation-First)

Redesigns the Rahhal entry experience into a conversation-first AI travel concierge home. Search forms are no longer the primary entry — talking to the AI is.

## Product principles

- Conversation first · AI before forms · Mobile-first · Premium UX
- Arabic-first with full RTL · English preserved
- Reusable design-system foundation (no hardcoded brand asset files)
- Preserves Sprints 9–15 behind flags / existing routes

## Architecture

```
Home (/)
  ├─ ui.ai_home ON  → AiHomeExperience
  └─ ui.ai_home OFF → LegacyHome (TravelConversationCard + QuickActions)

AiHomeExperience
  ├─ greeting / hero          (lib/aiHome/greeting)
  ├─ ConversationComposer     → /chat seed (ui.conversation_home)
  ├─ Suggested prompts        → chat or continue booking
  ├─ Continue booking         → BookingSession resume paths
  └─ Smart travel cards       → My Trips / Orders / curated prompts
```

BookingSession remains SoT. Home only **projects** records and orders.

## Feature flags

| Product alias | Registry ID | Depends on |
|---------------|-------------|------------|
| `ai_home` | `ui.ai_home` | `ai.concierge` |
| `conversation_home` | `ui.conversation_home` | `ui.ai_home` |
| `travel_cards` | `ui.travel_cards` | `ui.ai_home` |
| `continue_booking` | `ui.continue_booking` | `ui.ai_home`, `ui.my_trips` |

## Surfaces

### Hero
Personalized time greeting, welcome-back, “Where would you like to travel today?”, animated concierge affordance, brand-first Rahhal signal.

### Conversation entry
Natural language composer + voice button (UI-ready → Chat voice). With `ui.conversation_home`, submits to `/chat` with `seedMessage` (Sprint 9 agent). Fallback: `/travel-conversation` with `tripText`.

### Suggested conversations
Weekend · cheap Europe · honeymoon · family · business · continue booking (+ Tokyo / budget / Dubai extras). Cards open chat immediately.

### Continue booking
Unfinished `BookingSession` → status, remaining steps, Resume (passengers / review / return / checkout).

### Smart travel cards
Upcoming trips · recent orders · recommended destinations · travel inspiration · saved searches / price alerts (placeholders).

## Design system (`src/components/home`)

`SectionHeader` · `StatusChip` · `HomeButton` · `HomeCard` · `ConversationComposer` · `AiHomeHero` · `SuggestedPromptGrid` · `ContinueBookingPanel` · `TravelCardsSection` · skeleton / empty / error.

## Library

```ts
import {
  buildAiHomeModel,
  conversationEntryPath,
  listSuggestedPrompts,
  buildContinueBookingModel,
} from '@/lib/aiHome'
```

## Tests

`src/lib/__tests__/aiHome.sprint16.test.ts`

## Non-goals

- Replacing `/search` funnel (Playwright / classic OTA path preserved)
- Live voice STT on the home composer (UI-ready only)
- Hardcoding permanent brand illustration assets
- Breaking Sprints 9–15
