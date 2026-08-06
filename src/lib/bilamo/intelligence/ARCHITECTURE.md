# Bilamo Intelligence Layer

Senior luxury travel consultant brain. Visual UI is frozen; this layer owns conversation intelligence.

## Architecture

```
BilamoConversationExperience
  → chatEngine.sendMessage
    → chatService → travelAgentProvider
      → travelAgentService.planTurn
        → runBilamoIntelligenceTurn   ← consultant brain (soft-fail)
          → entity extraction
          → smart memory (never ask twice)
          → minimum clarification (1 hard slot)
          → parallel search orchestrator
          → consultant composer (explain #1 + alternatives)
        → legacy planner (fallback)
```

## Conversation flow

1. **Extract** entities from natural language (destination, dates, travelers, prefs).
2. **Recall** preferences (origin, airline, seat, hotel, budget, party style).
3. **Detect** missing hard slots only: destination → dates → travelers.
4. **Ask** one minimum follow-up. Budget is never required.
5. **Search in parallel**: flights ∥ hotels ∥ transfer ∥ weather ∥ visa ∥ currency ∥ time difference.
6. **Compose** a consultant recommendation (why #1, alternatives, short spoken line).
7. **Stream** phrase chunks for voice-friendly delivery.

## Intelligence modules

| Module | Role |
|--------|------|
| `conversationManager.ts` | Turn owner — extract → clarify → search → compose |
| `entityExtraction.ts` | NL → requirements (wraps `extractFromUserText`) |
| `smartMemory.ts` | Preferences + asked slots; never ask twice |
| `clarification.ts` | One hard-slot question policy |
| `searchOrchestrator.ts` | Parallel multi-domain search bundle |
| `consultantComposer.ts` | Explain / recommend / short spoken TTS |
| `feature.ts` | Gate (`ai.bilamo_intelligence` / provider opt-in) |

## Product wiring

- `createTravelAgentProvider` opts in with `bilamoIntelligenceEnabled: true`.
- Registry flag defaults OFF so legacy `createTravelAgentService()` unit tests stay stable.
- Results land on `providerMeta.bilamo.search` for FlightCard / HotelCard / TripTimeline.
