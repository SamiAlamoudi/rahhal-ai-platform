# Voice Session — Recovery Phase 2.3

Persistent continuous voice conversation for Rahhal `/chat`.

## State machine

```
IDLE
  → LISTENING          (one mic tap starts continuous session)
  → PROCESSING         (silence commit → speech cleanup → chatEngine.sendMessage)
  → SPEAKING           (only when real Web Speech TTS audio is playing)
  → READY              (brief hold)
  → LISTENING          (auto-restart; no second Start button)

When TTS is unavailable or mock:
IDLE → LISTENING → PROCESSING → READY → LISTENING

Explicit stop or inactivity timeout → ENDED
```

Arabic UX labels (exactly one at a time):

| State | Label |
|-------|--------|
| listening / reconnecting | يستمع إليك |
| processing / thinking / responding | يفكر |
| speaking | يتحدث |
| ready / idle | جاهز |
| ended | انتهت الجلسة |

## Authoritative owner

`createVoiceSessionManager` (`src/lib/chat/voice/voiceSessionManager.ts`) is the single owner:

- one recognition instance
- one timer set (utterance silence, inactivity, ready hold)
- one continuous session flag
- disposes any previous manager on create

Pipeline for voice turns (same as typed messages):

`SpeechRecognition → speechCleanup → chatEngine.sendMessage (modality: audio) → planTurn`

## Browser support

| Capability | Chrome / Edge (desktop) | Safari (iPhone) | Notes |
|------------|-------------------------|-----------------|-------|
| SpeechRecognition (STT) | Supported (`SpeechRecognition` / `webkitSpeechRecognition`) | Partial / version-dependent | Unsupported → Arabic message + typed fallback |
| Arabic STT language | Starts `ar-SA`, falls back to `ar` | Same when available | Never starts Arabic UI on `en-US` |
| TTS (`speechSynthesis`) | Real audio when voices exist | Often limited / quiet / missing Arabic voices | “يتحدث” only when real TTS is playing |
| Auto barge-in (speak over TTS) | **Not reliable** with Web Speech API | **Not reliable** | Manual **مقاطعة** while `speaking` stops TTS; we do not simulate barge-in |
| Continuous listen loop | Yes | Best-effort; OS may end recognition | Session resumes on `onend` while continuous |

### Fallbacks

- Mic permission denied → status `error`, concise Arabic message, retry permission, typing still works
- STT unsupported → status `error`, “استخدم الكتابة”, no stuck mic
- no-speech → recover / resume listening in continuous mode
- network / response failure → stop timers & mic, recoverable `error`, typing fallback
- TTS failure → do not claim Speaking; return to READY → LISTENING

## Real TTS

Enabled when the factory selects `web-speech-tts` and `speechSynthesis` exists.

Mock TTS (tests / unsupported browsers) may still receive speak calls for side-effect logging, but the session **never** sets status to `speaking`.

## Real interruption

Supported only as **manual barge-in while Speaking** (`tts.stop()` + cancel remaining utterance + return to listening).

Automatic VAD barge-in over playing TTS is **not** claimed — Web Speech Recognition cannot reliably run concurrently with `speechSynthesis` across browsers.

## Defaults

- Continuous conversation mode (hands-free) is the default voice experience
- End-of-utterance silence: 2200ms (short pauses tolerated)
- Session inactivity end: 45s of idle listening with no speech
- Push-to-talk remains available as a secondary mode (no second architecture)
