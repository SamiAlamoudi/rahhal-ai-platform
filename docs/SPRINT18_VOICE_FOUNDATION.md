# Sprint 18 — Production Voice Conversation Foundation

Transforms Rahhal from “voice input” (Home mic / Chat STT) into a **conversational AI architecture** without enabling realtime providers.

## Non-goals (strict)

- No OpenAI Realtime (or any realtime) network connection
- No API keys / secrets
- No audio generation or playback
- No fake assistant conversations
- No changes to the production Home microphone path (`useSpeechRecognition`)

## Architecture

```
Library (production SoT)
VoiceSession  ──owns──► StateMachine + VoiceQueue + Timeline
        │
        ▼
VoiceProvider  ──► VoiceTransport + VoiceAudio
        │
        ├── MockVoiceProvider          (active architecture harness)
        ├── OpenAIRealtimeProvider     (stub)
        ├── AzureRealtimeProvider      (stub)
        └── ElevenLabsProvider         (stub)
```

Existing Home mic (`src/hooks/useSpeechRecognition.ts`) and Chat `src/lib/chat/voice` remain unchanged. Sprint 18 is additive.

## State machine

| State | Meaning |
|-------|---------|
| `idle` | No active turn |
| `listening` | Capturing user speech (provider/session level) |
| `thinking` | User utterance committed; awaiting assistant |
| `speaking` | Assistant response in progress (architecture; no TTS yet) |
| `paused` | Temporarily paused |
| `interrupted` | Barge-in acknowledged |
| `disconnected` | Transport down |
| `error` | Terminal recoverable error |

**Interruption:** speaking/thinking → `interrupted` → `listening`. Outgoing queue items below critical priority are cancelled. Transition lock prevents races / duplicated state.

## Modules (`src/lib/voiceConversation`)

| Module | Responsibility |
|--------|----------------|
| `types.ts` | `VoiceSession`, `VoiceState`, `VoiceMessage`, `VoiceEvent`, timeline types |
| `stateMachine.ts` | Allowed transitions |
| `voiceQueue.ts` | Incoming/outgoing cancelable priority queue |
| `timeline.ts` | User/assistant speech, thinking, latency, errors, reconnects |
| `session.ts` | `createVoiceSession` controller |
| `providers/*` | `VoiceProvider` / `VoiceTransport` / `VoiceAudio` + stubs + mock |

## Hooks / UI

Sprint 18 shipped optional React hooks and presentational voice chrome. Those wrappers were **removed in Sprint 73.5** (unused / never mounted). Use `src/lib/voiceConversation` directly.

## Feature flags (default **OFF**)

| Product alias | Registry ID | Depends on |
|---------------|-------------|------------|
| `voice_conversation` | `ui.voice_conversation` | `ai.concierge` |
| `voice_realtime` | `voice.realtime` | `ui.voice_conversation` |
| `voice_provider` | `voice.provider` | `ui.voice_conversation` |
| `voice_mock` | `voice.mock` | `ui.voice_conversation` |

Factory always resolves to **MockVoiceProvider** in Sprint 18. Live stubs throw if invoked.

## Library entry

```ts
import {
  createVoiceSession,
  createVoiceProvider,
  createMockVoiceProvider,
  canTransition,
} from '@/lib/voiceConversation'
```

## Tests

`src/lib/__tests__/voiceConversation.sprint18.test.ts`

## Compatibility

- Sprint 9–17 flows unchanged
- Production mic continuous UX unchanged
- No payment / provider live switches
