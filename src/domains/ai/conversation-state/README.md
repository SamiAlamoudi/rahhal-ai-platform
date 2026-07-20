# ai/conversation-state

## Responsibilities

Conversation UI/controller state helpers from chat, plus brain conversation memory types/API.

## Public API

- Selected state helpers from `src/lib/chat`
- Conversation memory types from `src/lib/brain/types`
- `src/lib/brain/conversationMemory`

## Dependencies

`conversation` domain sources. No UI components.

## Rules

- Does not re-export the entire chat package (avoids pulling voice/engine into this sub-module).
- Compatibility shim only.
