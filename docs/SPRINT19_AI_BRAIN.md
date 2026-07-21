# Sprint 19 — AI Travel Brain

Production conversation intelligence layer for Rahhal’s travel concierge.

## Non-goals (strict)

- No OpenAI / Anthropic / other LLM provider integration
- No external travel APIs from the brain package
- No fabricated natural-language assistant replies
- No breaking changes to `src/lib/agent` or `src/lib/concierge`

## Architecture

```
User text
   │
   ▼
IntentClassifier
   │
   ▼
RequirementExtractor
   │
   ▼
MemoryManager (ConversationMemory)
   │
   ▼
MissingInformationDetector  ──ask only missing; never twice──►
   │
   ▼
TravelPlanner
   │
   ▼
ResponsePlanner  → BrainResponsePlan (structured only)
```

Owned by `ConversationOrchestrator` with `ContextManager` as the single context owner.

## Modules (`src/lib/brain`)

| Module | Responsibility |
|--------|----------------|
| `ConversationMemory` | Slot memory (destination, budget, dates, travelers, cabin, airlines, hotels, activities, visa, language, currency) |
| `ConversationContext` | Memory + history + goals + preferences + missing fields |
| `ConversationHistory` | Turn log |
| `TravelGoals` / `TripPreferences` | Goal & preference sketches |
| `IntentClassifier` | Travel intents (rule-based) |
| `RequirementExtractor` | Entity / slot extraction |
| `MissingInformationDetector` | Slot filling; never ask twice |
| `TravelPlanner` | Next domain action + search hints |
| `ResponsePlanner` | Structured response plan |
| `ContextManager` / `MemoryManager` | Mutable owners |
| `ConversationOrchestrator` | Turn pipeline |

## Travel intents

`SearchFlights`, `SearchHotels`, `SearchPackages`, `ModifyTrip`, `CancelBooking`, `ContinueBooking`, `AskRecommendation`, `TravelAdvice`, `VisaQuestion`, `WeatherQuestion`, `BudgetPlanning`, `PackingAdvice`, `GeneralConversation`

## Response plan contract

```ts
{
  summary, assistantGoal, missingFields, action,
  uiHints, searchRequests, bookingRequests, recommendations,
  intent, confidence
}
```

`summary` / `assistantGoal` are machine-readable tokens (e.g. `need_slot:destination`, `ready:search_flights`) — not LLM prose.

## Hooks / UI

Sprint 19 shipped optional React hooks and brain debug viewers. Those wrappers were **removed in Sprint 73.5** (unused / never mounted). Use `src/lib/brain` directly.

## Feature flags (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_enabled` | `brain.enabled` | `ai.concierge` |
| `brain_memory` | `brain.memory` | `brain.enabled` |
| `brain_intent` | `brain.intent` | `brain.enabled` |
| `brain_planner` | `brain.planner` | `brain.enabled` |
| `brain_debug` | `brain.debug` | `brain.enabled` |

## Library entry

```ts
import {
  ConversationOrchestrator,
  IntentClassifier,
  RequirementExtractor,
  MissingInformationDetector,
} from '@/lib/brain'
```

## Tests

`src/lib/__tests__/aiBrain.sprint19.test.ts`

## Compatibility

- Sprints 9–18 unchanged
- Agent `TripRequirements` / Concierge remain production SoT until a later wiring sprint
- Home mic + voice conversation foundation unchanged
