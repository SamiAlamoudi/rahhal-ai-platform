# Voice Architecture Sprint — Evidence Report

**Date:** 2026-07-28  
**Repo branch:** `cursor/voice-architecture-realtime-71ec`

## Question

Is `gpt-4o-mini-tts` the quality bottleneck, and can Rahhal migrate to the newest OpenAI conversational speech architecture to approach ChatGPT Voice?

## Official architecture map (OpenAI docs)

| Goal | Official API | Model |
|------|--------------|-------|
| Low-latency **voice agent** | Realtime `/v1/realtime` | `gpt-realtime-2.1` |
| Generate speech **from text** | Audio Speech `/v1/audio/speech` | `gpt-4o-mini-tts` |
| ChatGPT Voice (consumer) | **Not a public API** | GPT-Live-1 / GPT-Live-1 mini |

Sources:
- [Realtime and audio overview](https://developers.openai.com/api/docs/guides/realtime) — routes voice agents to `gpt-realtime-2.1`, speech generation to TTS.
- [Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech) — `gpt-4o-mini-tts`; voices “currently optimized for English”.
- [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) — speech-to-speech without intermediate STT/TTS.
- [Introducing GPT-Live](https://openai.com/index/introducing-gpt-live/) — ChatGPT Voice models; “We also plan to bring them to the API soon.”

## 1) Is gpt-4o-mini-tts the bottleneck?

**Yes — for ChatGPT-Voice-like quality, the architecture is the bottleneck, not coral/nova/marin.**

Evidence:
1. TTS is **request-based text → audio**. It never hears the traveler’s audio prosody.
2. Official docs separate TTS from voice-agent Realtime; they are different products.
3. TTS voices are officially **optimized for English**.
4. Tweaking voices cannot add breathing/overlap/full-duplex conversational dynamics of ChatGPT Voice / GPT-Live.

## 2) Can Realtime Speech replace classic TTS?

**Yes, via the public Realtime API (speech-to-speech).**  
This is a **different architecture than TTS** (mic audio ↔ model audio over WebRTC), not a better TTS voice.

Highest public voice-agent model today: **`gpt-realtime-2.1`**.

## 3) Can we reproduce ChatGPT Voice exactly?

**No.** ChatGPT Voice is powered by **GPT-Live**, which OpenAI has **not** released on the public API (only “planned soon”).  
Closest public stack: Realtime `gpt-realtime-2.1` (related speech-to-speech lineage, not GPT-Live).

## Objective comparison

| Dimension | Classic `gpt-4o-mini-tts` | Public Realtime `gpt-realtime-2.1` | ChatGPT GPT-Live |
|-----------|---------------------------|-------------------------------------|------------------|
| Naturalness | Text-reader quality ceiling | Speech-to-speech, higher | Highest (consumer) |
| Emotion / breathing / prosody | Instruction-limited | Native audio generation | Full-duplex Live |
| Conversational flow | Turned text then speak | Live VAD turns + barge-in | Continuous Live |
| Arabic | Works; EN-optimized voices | Works via S2S model | Product-dependent |
| Latency | Model complete + TTS (~1–2s+) | Streaming audio | Lowest in ChatGPT |
| Interruption | Client stop of audio element | `response.cancel` + VAD barge-in | Native |
| Production readiness | GA, simple | GA WebRTC/WebSocket | ChatGPT only |
| Public API | Yes | Yes | **No** |

## What we implemented

- `/api/openai/realtime-call` — unified WebRTC SDP exchange (server key)
- `/api/openai/realtime-session` — capability probe + ephemeral client secrets
- Home voice prefers Realtime when API key is configured; classic TTS remains fallback
- Grounding instructions forbid inventing travelers/budget/destination/dates
- Interrupt via `response.cancel` + audio buffer clear
- One remote WebRTC audio stream (no multi-clip TTS stitch)

## Outcome (forced choice)

### **A) Migration completed.**

Rahhal Home voice now defaults to the **highest-quality speech architecture OpenAI officially exposes today**: Realtime speech-to-speech (`gpt-realtime-2.1`), not classic TTS.

### Clarifying notes (not alternate outcomes)

- Exact **ChatGPT GPT-Live** parity remains **blocked** by public API availability (documented “API soon”).
- Achieving ChatGPT-Voice-class quality required **outcome C’s architecture change** (Realtime ≠ TTS); that migration is what A delivers.

## Preserve checklist

| Requirement | Status |
|-------------|--------|
| One assistant turn / one audio stream | WebRTC remote track (no multi TTS clips) |
| Interruption | `response.cancel` + VAD speech_started barge-in |
| Low latency | Streaming S2S vs post-hoc TTS |
| No duplicate playback | Single RTC audio element |
| No hallucinated context | Session instructions + greeting reset |

## Verification probes

After deploy, hit:
- `GET /api/openai/realtime-session` → `{ configured, model, chatgptVoiceParity }`
- `POST /api/openai/realtime-session` → ephemeral `ek_…` or upstream error detail
- Home mic → Network shows `/api/openai/realtime-call` (SDP), not `/api/openai/tts`

---

## Final Voice Experience Sprint (engine frozen)

**Goal:** feel like a senior Saudi travel consultant — not traditional TTS narration.  
**Constraint:** Realtime architecture unchanged; conversational layer only.

Shipped:
- Mood-aware emotion cues (greeting / honeymoon / luxury / budget / family / business / disruption / angry / open)
- Saudi / Gulf / Neutral wording guidance (vocabulary change, not accent theatre)
- Spoken-dialogue post-processor: short breaths, one question, formal strip, natural variation
- `session.update` mood refresh on each traveler text turn (instructions only)
- Scenario unit coverage in `finalVoiceExperience.scenarios.test.ts`

**Freeze:** after this sprint, voice stack is frozen unless critical bugs. Next milestone: flights / hotels / cars / multi-provider price comparison.
