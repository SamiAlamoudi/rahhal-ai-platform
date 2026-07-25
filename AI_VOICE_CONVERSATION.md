# AI Voice Conversation Experience — Phase 3

**Status:** Additive UX · Mock VoiceAdapter only · No engine / booking / provider API changes  
**Spine:** `ChatPage` → existing `voiceSession` → `chatEngine` → `planTurn` (unchanged)

## Architecture summary

```text
User mic / Space (PTT)
        ↓
VoiceComposer + VoicePanel (UI)
        ↓
voiceSession (existing) ← STT/TTS providers (web/mock)
        ↓
chatEngine.sendMessage  (unchanged)
        ↓
streamUi coalescer → MessageBubble (progressive markdown + cards)
        ↓
TTS speak (existing)
```

## VoiceAdapter

Package: `src/lib/premiumExperience/voiceAdapter.ts`

| Provider | Runtime |
|----------|---------|
| `mock` | **Active** (default) |
| `openai_realtime` | Prepared label only |
| `gemini_live` | Prepared label only |
| `azure_voice` | Prepared label only |
| `deepgram` | Prepared label only |
| `web_speech` | Prepared label only |

No sockets. No HTTP. Keys only change the label/id; execution stays mock-safe.

## Voice flow

1. **Idle** — breathing glow on floating panel  
2. **Listening** — pulse mic + waveform  
3. **Thinking** — animated dots + status  
4. **Speaking** — waveform + Stop / Interrupt  
5. **Esc** — stop speaking / cancel stream  
6. **Space** — push-to-talk (existing VoiceComposer)

## Streaming flow

1. Assistant message `status: streaming`  
2. Thinking rail until first tokens  
3. Markdown renders progressively as content grows  
4. Smart cards reveal via `progressiveCardLimit(contentLength)`  
5. On complete — full cards + actions  

## Components

- `src/components/premium/VoicePanel.tsx` — floating panel (lazy-loaded)  
- `src/components/chat/VoiceComposer.tsx` — mode/locale/PTT (Phase 2+)  
- `src/lib/premiumExperience/streamingCards.ts` — progressive limits  

Frozen Sprint 18 flags (`ui.voice_conversation`, `voice.*`) remain **OFF**.
