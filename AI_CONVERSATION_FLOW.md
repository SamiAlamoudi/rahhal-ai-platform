# Conversation Flow — Phase 7 Stage 12

```text
User Message
    ↓
Personalization
    ↓
Preference Extraction
    ↓
Traveler Context
    ↓
Intent Recognition
    ↓
Travel Planning
    ↓
Travel Search
    ↓
Recommendation
    ↓
Offer Decision
    ↓
Booking Draft
    ↓
ConversationBrainResult
```

## Coordinated engine hints

| Stage | Engine hint |
|-------|-------------|
| Personalization | `personalization_engine` (`brain.personalization_engine`) |
| Preference Extraction | `preference_extraction_engine` |
| Traveler Context | `traveler_context_engine` |
| Intent Recognition | `intent_recognition_engine` |
| Travel Planning | `travel_planning_engine` |
| Travel Search | `travel_search_orchestrator` |
| Recommendation | `travel_recommendation_engine` |
| Offer Decision | `offer_decision_engine` |
| Booking Draft | `booking_orchestrator` |

Coordination is architectural only — each engine remains behind its own flag and package boundary.
