# OpenAI Realtime — Latency & Metrics Report

**Sprint:** Integration Program · Sprint 1  
**Branch:** `cursor/openai-realtime-voice-7518`  
**Generated:** 2026-07-25  

---

## Instrumentation

| Metric | Where | Meaning |
|---|---|---|
| Voice start latency | `OpenAIRealtimeProvider.latencySamples.voiceStartMs` | `connect()` start → WebSocket session.update ready |
| Round-trip latency | `latencySamples.roundTripMs` | connect start → first assistant audio/text delta |
| Session metrics | `RealtimeSession` → `LatencyMonitor` | STT / reason / TTS averages (existing) |
| Reconnect duration | `ReconnectManager` + `LatencyMonitor.recordReconnect` | Existing failover path |
| Audio buffering | `AudioTransport` queue depth | Existing seam; provider `pushAudio` feeds WS |

---

## CI harness results (fake WebSocket)

| Scenario | Observed |
|---|---|
| Ephemeral mint + socket open | `voiceStartMs` sample recorded (>0 length) |
| Streaming transcript deltas | Partial + final events emitted |
| Interrupt | `response.cancel` + `input_audio_buffer.clear` sent |
| PCM upload | `input_audio_buffer.append` sent |
| Tool mock round-trip | `function_call_output` + `response.create` |
| Failover (no server key) | OpenAI → mock without hanging |

Exact wall-clock numbers against OpenAI production are **environment-dependent** and must be captured in staging:

```text
Target budgets (staging soak)
- Voice start (mint + WS):  p50 < 800ms · p95 < 2000ms
- First assistant token:    p50 < 1200ms · p95 < 3000ms
- Interrupt ack:            p95 < 250ms
- Reconnect to mock:        p95 < 500ms
```

---

## How to collect staging numbers

1. Enable flags + server `OPENAI_API_KEY`  
2. Open `/chat`, switch to voice, enable `ai.realtime_voice`  
3. Log `provider.latencySamples` after a 5-turn conversation  
4. Log `session.getMetrics()` from `VoiceSession`  
5. Attach results to the staging soak checklist  

---

## Streaming UX (reused)

Existing VoicePanel / VoiceComposer indicators continue to map session states:

| State | UI |
|---|---|
| listening | Listening indicator |
| transcribing / reasoning | Thinking |
| speaking | Speaking |
| interrupted | Interrupt animation |
| reconnecting / disconnected | Reconnect status |

No UI redesign in this sprint.
