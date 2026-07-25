# Session Architecture — Phase 6 Stage 2

## Session

`ConversationSessionContract` — session id, locale, opened timestamp, state id, coordinated modules.

## Timeline

`ConversationTimelineContract` — ordered label entries (architecture markers).

## State machine

`ConversationStateMachineContract` states:

`idle` → `listening` → `understanding` → `clarifying` → `planning` → `deciding` → `responding` → `awaiting_user` → `closed`

Transitions are descriptive only (`execution: 'none'`).

## Events & queues

- `ConversationEventContract` — session/turn/intent/context/memory/response events
- `TaskQueueContract` / `PlanningQueueContract` — empty queue shapes
- `ConversationAnalyticsContract` — counters with `exported: false`

## Registry

`ConversationRegistry.list()` maps each UI module to a coordination role (shell, conversation, workspace, decision, memory, booking, operations, integration).
