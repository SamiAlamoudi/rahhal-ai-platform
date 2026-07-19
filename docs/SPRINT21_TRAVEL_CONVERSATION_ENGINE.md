# Sprint 21 — Real Travel Conversation Engine

Connects the AI Travel Brain to real Rahhal travel domain surfaces so conversations use project data (flights, hotels, itineraries, booking sessions, passenger profiles).

## Non-goals (strict)

- No OpenAI / Azure / ElevenLabs / other external LLM APIs
- No live provider search execution from Brain (drafts + structured plans only)
- No breaking changes when `brain.travel_engine` is OFF

## Behavior

```
User (text OR speech)
        │
        ▼
ConversationOrchestrator (travelEngine mode)
  Intent → Extract → Memory → Missing(domain slots) → TravelPlanner → ResponsePlanner
        │
        ├─ BrainResponsePlan
        ├─ TravelPlan (flights / hotels / itinerary / booking / passengers)
        ├─ TravelDomainBridge (search draft, passenger slots, booking draft)
        └─ exactly ONE contextual follow-up when a slot is missing
        │
        ▼
planTurn / voice commit (same pipeline)
```

### Detection (rule-based)

Automatically extracts when present in user text:

destination, departure city (origin), travel dates / flexible dates, traveler count, adults / children / infants, cabin class, hotel requirement + preferences, budget, preferred airlines, preferred hotels.

### Memory rules

- If a slot is already filled → **never ask again**
- If missing → ask **exactly one** short contextual question
- Known facts are acknowledged in the follow-up (budget, family size, airlines, hotels, trip style)

### Example

Prior memory: budget 8000 SAR, family 2 adults + 2 children, Saudia, resort  
User: “I want to visit Japan.”  
→ Remembers prior slots; asks only for travel dates.

## Feature flags (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `brain_travel_engine` | `brain.travel_engine` | `brain.concierge` |

Requires parent `brain.enabled` + `brain.concierge` (Sprint 19/20).

## Modules

| File | Role |
|------|------|
| `src/lib/brain/contextualReply.ts` | One short contextual follow-up |
| `src/lib/brain/travelPlanBuilder.ts` | Structured `TravelPlan` |
| `src/lib/brain/domainBridge.ts` | Flights/hotels/itinerary/booking/passenger drafts |
| `src/lib/brain/requirementExtractor.ts` | Enhanced slot extraction |
| `src/lib/brain/missingInformationDetector.ts` | Domain slots when engine on |
| `src/lib/brain/integration.ts` | Flag helper + shared text/voice entry |

## Compatibility

- Flags OFF → Sprint 19/20 behavior unchanged
- Voice and text share `runIntegratedBrainTurn` (identical reasoning)
- Agent `TripPlan` / Concierge paths remain intact

## Tests

`src/lib/__tests__/travelConversationEngine.sprint21.test.ts`
