# Final Voice Experience Sprint — ChatGPT Voice parity

**Date:** 2026-07-28  
**Branch:** `cursor/final-voice-experience-71ec`  
**Constraint:** WebRTC + OpenAI Realtime (`gpt-realtime-2.1`) unchanged — conversational + turn config only.

## Objective

Experience parity with ChatGPT Voice (not feature parity / not GPT-Live API access).

A traveler should feel they are talking to a **senior human travel consultant**, not software.

## Architecture (frozen)

| Layer | Status |
|-------|--------|
| WebRTC SDP → `/api/openai/realtime-call` | Unchanged path |
| Model | `gpt-realtime-2.1` |
| Classic TTS | Fallback only |

## What we improved (no engine rewrite)

### 1) Natural realtime conversation
- Turn detection → **`semantic_vad`** (`eagerness: medium`, `create_response`, `interrupt_response`)
- Closer to ChatGPT Voice end-of-turn than fixed 700ms silence
- Server + client `session.update` aligned

### 2) Human speaking style
- Senior consultant persona; anti IVR / GPS / announcer / narrator / CS
- Short spoken sentences; soft rotating acknowledgements
- Spoken post-processor strips formal / AI-answer / process-narration phrases

### 3) Emotional speech
- Moods: greeting, luxury, family, business, weather, cancellation, price_drop, expensive, confirmation, angry, …
- Mood refreshed per traveler turn via `session.update`

### 4) Dynamic prosody
- Instructions vary pitch / speed / energy / pause / stress every turn
- User prefs: `speed` + new `energy` (calm / natural / lively) → Realtime speaking cues

### 5) Interruptions
- `interrupt_response: true` (server)
- Client: `response.cancel` + `output_audio_buffer.clear` + mute remote track
- Never replay cancelled speech; partial transcript kept; resume on new utterance only

### 6) Turn detection
- Semantic VAD (medium eagerness) for instantaneous-but-complete turns
- Fallback helper `buildServerVadFallback()` retained (520ms silence) if needed later

### 7) Voice memory (not trip memory)
- localStorage `rahhal.voiceExperience.v1:<userId>`
- Fields: voice, dialect, speed, gender, **energy**
- Future-ready dialects: Egyptian, Levantine (+ existing Saudi / Gulf / MSA / Moroccan)

### 8) Arabic quality
- Native spoken wording guidance; MSA when selected
- Strip literal / formal / AI wording in post-processor

### 9) Conversation intelligence
- Guide / recommend / compare / advise / challenge / anticipate
- Explicitly not FAQ / booking engine / CS

### 10) Zero narration
- Forbidden: “I will now…”, “Let me search…”, “I'm searching…”, خلني أقارن الأسعار…
- Quietly work; answer with the result

### 11) Realtime quality metrics
Client tracker `realtimeQualityMetrics.ts` measures:
- Speech interruption latency
- Turn detection latency (`speech_stopped` → `response.created`)
- First audio latency (`speech_stopped` → first assistant delta)
- Average response time
- Conversation overlap count
- False interruption rate (heuristic)
- Audio restart count

Emitted via `onQualitySnapshot` + `logChat('realtime_quality', …)`.

## Objective measurement targets

| Metric | Target (ChatGPT-Voice class) | How measured |
|--------|------------------------------|--------------|
| Speech interruption latency | < 100ms perceived (cancel+clear sync) | `speechInterruptionLatencyMs` |
| Turn detection latency | typically < 400ms after complete utterance | `turnDetectionLatencyMs` |
| First audio latency | ideally < 800ms after user stop | `firstAudioLatencyMs` |
| False interruption rate | < 10% | `falseInterruptionRate` |
| Audio restart count | ≈ 0 per healthy turn | `audioRestartCount` |
| Process narration phrases | 0 in spoken output | unit + live wording probes |
| Multi-question turns | ≤ 1 `؟` | spoken post-processor |

## Comparison note (GPT-Live)

Exact ChatGPT Voice = **GPT-Live** — **not** on the public API.  
Closest public stack remains Realtime `gpt-realtime-2.1`. Side-by-side video vs ChatGPT app requires a human holding both clients; this sprint maximizes experience within the public Realtime path.

## Validation checklist

- [x] Unit: moods, zero narration, semantic_vad config, quality tracker
- [x] Typecheck
- [ ] Production wording probe (zero narration / emotion)
- [ ] Live WebRTC metrics sample on production
- [ ] Comparison video artifact (Rahhal Realtime demo; ChatGPT Voice optional external)

## Deploy gate

Deploy only when wording + turn config + metrics instrumentation meet the bar above and production probes show human, non-narrating, non-repetitive consultant speech.
