# Production Brain UI Migration

**Sole conversation source:** `TravelBrain.processTurn` via `BrainProvider` / `BrainSessionController`.

## Product routes

| Route | Page |
|-------|------|
| `/` | Home (BrainHomeScreen) |
| `/chat` | Chat (BrainChatScreen) |
| `/voice` | Voice (mock STT → TravelBrain) |
| `/conversation` | → `/chat` |
| `/recommendations` | RecommendationEngine |
| `/planning` | TripPlanner |
| `/timeline` | Timeline |
| `/continue-trip` | Continue from memory |
| `/profile/recommendations` | Preference + recs |
| `/search` | Search → TravelBrain |

## Removed from product ownership

- LegacyChatPage local chat state
- Home → AiHomeExperience / NewHomeExperience / chatEngine voice
- SearchWorkspace travelSession conversation spine
- `travelAgentService.planTurn` as turn owner

`chatEngine` remains only as a deprecated TravelBrain adapter for residual tests.
