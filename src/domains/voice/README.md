# voice

## Responsibilities

Voice conversation sessions and speech providers (STT/TTS), including chat-attached voice helpers.

## Public API

- `src/lib/voiceConversation` (package index)
- Selective exports from `src/lib/chat/voice/*` (no package index yet)

## Dependencies

May use `shared`, `conversation`, `infrastructure`. Must not import UI.

## Rules

- `src/lib/chat/voice` has no `index.ts`; exports are named from concrete files.
- Compatibility shim only.
