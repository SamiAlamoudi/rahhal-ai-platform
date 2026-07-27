# voice

## Responsibilities

Production voice I/O for `/chat`: Speech-to-Text → chatEngine → Text-to-Speech.

## Public API

- `src/lib/chat/voice/voiceSession.ts`
- `src/lib/chat/voice/voiceProviderFactory.ts`
- `src/lib/chat/voice/microphonePermission.ts`
- `src/lib/chat/voice/voiceTypes.ts`

## Dependencies

May use `shared`, `conversation`, `infrastructure`. Must not import UI.

## Rules

- Sole production voice path. Experimental realtime / Sprint 18 runtimes were removed.
- Compatibility shim only.
