# Experience Sprint 1 — Conversation-first Travel Advisor

**Goal:** Make Rahhal feel closer to ChatGPT Voice — a calm human travel advisor, not a booking form.

**Non-goals:** No new AI engines, no architecture refactors, no new travel modules.

## What changed

### Conversation
- Follow-ups are warm + **one** natural question (no “Next question”, inventories, or wizard language).
- Extraction understands `two weeks`, `with my wife/husband/spouse`, Arabic `زوجتي` → couple + 2 travelers.
- Concierge asks at most one question per turn.

### Voice
- Default chat voice mode: **hands-free**.
- Silence tolerance: **3.5s** (think pauses).
- STT restart **preserves** the utterance buffer (no mid-thought wipe).
- Provider emits an immediate **spoken bridge** (`spokenText` / `voicePhase: 'bridge'`).
- Final TTS uses **`spokenText` only** — short summary; full itinerary stays on screen.
- Interrupt still stops TTS/stream immediately.

### Screen vs speech
- Plan replies = conversational opener + rich markdown details.
- `AgentProviderMeta.spokenText` carries what should be spoken.

## Example

**User:** “I want to spend two weeks in Japan next August with my wife.”

**Rahhal understands:** Japan · 14 days · August · couple · 2 travelers  

**Speaks (bridge):** “Give me a second — I already have a few ideas…”  

**Then asks at most one missing hard slot** (e.g. budget), conversationally — never a form list.

When the plan is ready, **speaks a short summary**; the daily itinerary/hotels/flights render on screen.

## Remaining limitations

- Still rule-based (no generative LLM) — prose is curated, not model-composed.
- Half-duplex: no true listen-while-speaking barge-in mic loop (interrupt is explicit).
- Browser Web Speech STT/TTS quality varies by device/OS.
- Fake character streaming remains for UI; audio no longer waits on the full itinerary text.
