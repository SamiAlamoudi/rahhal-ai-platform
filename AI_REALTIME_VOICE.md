# Real AI Voice Integration — Phase 7

**Status:** Additive · Production flag **OFF** · Live sockets disabled by default · Draft PR only  
**Continues from:** Phase 6 Agent Runtime (#261)  
**Reuses:** Agent Runtime · Conversation Intelligence · LLM Brain · Voice UX (VoiceAdapter / VoicePanel)

## Mission

Multi-provider realtime voice architecture with failover.  
Default execution is **Mock** (development). Production live providers require explicit allow flags + env keys (never committed).

## Feature flags

| Flag | Default | Notes |
|------|---------|-------|
| `ai.realtime_voice` | **OFF** | Production disabled |
| Dev opt-in | `VITE_REALTIME_VOICE_DEV=true` (DEV only) | Enables integration without flipping registry |
| Live sockets | `VITE_VOICE_LIVE_ALLOW=true` + provider key | Required for any real network provider |

Distinct from frozen Sprint 18: `ui.voice_conversation`, `voice.realtime`, `voice.provider`, `voice.mock`.

## Package

`src/lib/realtimeVoice/`

| Module | Role |
|--------|------|
| `VoiceSession` | UX façade |
| `RealtimeSession` | Live conversation loop |
| `AudioTransport` | Audio buffering |
| `VoiceProvider` | Provider interface |
| `VoiceConnection` | Active connection |
| `VoiceState` | State machine |
| `ReconnectManager` | Backoff reconnect |
| `LatencyMonitor` | Debug metrics |

### Providers (same interface)

- `MockProvider` — default, duplex simulation  
- `WebSpeechProvider` — browser fallback (no cloud keys)  
- `OpenAIRealtimeProvider` — prepared; no sockets unless live allow  
- `GeminiLiveProvider` — prepared  
- `AzureRealtimeProvider` — prepared  

## Architecture

```text
Mic / pushTranscript
        |
        v
VoiceProvider (mock | web_speech | openai | gemini | azure)
        |
        +-- failover chain --> mock
        |
        v
RealtimeSession
  partial STT --> Agent Runtime (incremental memory + reason)
        |
        v
streaming TTS chunks --> Voice UX (VoiceAdapter / VoicePanel)
```

## Realtime sequence

```text
connect -> listening
user partial -> transcribing -> AgentRuntime(partial) -> memory update
user final   -> reasoning -> speak(stream) -> listening
user barge-in -> interrupt -> stop TTS -> listening (instant)
disconnect / error -> reconnect manager -> failover
```

## Voice session flow

1. `VoiceSession.start()` → `connectWithFailover`  
2. `pushTranscript` / provider STT partials  
3. Incremental `runAgentRuntime` (no wait for recording end)  
4. Stream assistant text via provider `speak`  
5. `interrupt()` stops speech immediately  

## Latency report (mock path)

Metrics on `session.getMetrics()`:

- `latency.sttMs` / `reasonMs` / `ttsMs` / `roundTripMs`  
- `reconnectCount` · `droppedPackets` · `streamingCharsPerSec`  
- Debug only — no production UI  

## Security

- No API keys in repo  
- Keys only via `VITE_OPENAI_REALTIME_KEY`, `VITE_GEMINI_LIVE_KEY`, `VITE_AZURE_VOICE_KEY`, …  
- Live network gated by `VITE_VOICE_LIVE_ALLOW`  

## Integration

- `createVoiceAdapter()` uses realtime session **only when** `ai.realtime_voice` is enabled  
- Flag OFF → Phase 3 mock/prepared adapters unchanged  

## Test report

Suite: `src/lib/__tests__/realtimeVoice.phase7.test.ts` (10/10)

| Check | Result |
|-------|--------|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run arch:circular` | pass |
| `npm run test:run` | **229 files / 2671 tests passed** |
