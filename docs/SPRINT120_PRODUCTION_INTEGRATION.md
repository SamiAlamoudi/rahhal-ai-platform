# Sprint 120 — Connect Premium UI to Existing AI Platform

**Type:** Integration only (`src/lib/uiIntegration` + `src/ui/integration`)  
**Does not** create AI engines or redesign backends.

## Objective

Bind Sprint 119 Premium UI shells to production modules:

- Memory Engine
- Execution Pipeline
- Streaming Conversation
- Editable Conversation
- Chat persistence (`chatEngine`)
- My Trips / bookings

## Architecture

```
ui.production_integration (OFF by default)
        ↓ ON
Home → ProductionHomeScreen
        ↓ loadProductionHomeData
   Memory + chatEngine.listConversations + loadMyTrips

Chat → ProductionConversationScreen
        ↓ runProductionConversationTurn
   runStreamingConversation → Pipeline (forced enabled for wrap call)
        ↓ cards / timeline / progress from mappers

Edit → runProductionEditTurn
        ↓ runConversationEditor (Partial Execution)
```

## Feature flag

`ui.production_integration` — **default OFF**

When OFF, legacy `Home` / `ChatPage` paths are unchanged.

## Mapping

`mappers.ts` converts `PipelineResult` / streaming events into Sprint 119 card & timeline props — no duplicated ranking/search logic.

## Verify

```bash
npm run integration:verify
```
