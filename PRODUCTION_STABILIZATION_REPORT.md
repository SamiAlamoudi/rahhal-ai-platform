# Production Stabilization Report

**Objective:** Make Rahhal’s conversation experience production-ready.  
**Scope freeze:** No new business features, engines, or capabilities — stabilize microphone → STT → conversation persistence → AI → TTS.

---

## Root causes found

### 1. Voice recording stops before the user finishes speaking

| Cause | Location | Impact |
|-------|----------|--------|
| Hands-free sent on **every Web Speech `onFinal`** | `voiceSession.ts` (pre-fix) | Short natural pauses finalize mid-sentence |
| Home silence timer **armed on mic start** | `useSpeechRecognition.ts` | Thinking before speaking (≥ silence window) auto-stopped empty/partial turns |
| No VAD / energy hold | Missing | Silence timers could fire while the user was still producing speech energy |
| Chat STT `stop()` detached handlers immediately | `webSpeechToTextProvider.ts` | Race losing late finals |

There is **no MediaRecorder / Whisper upload path** in the current architecture (browser Web Speech STT). Stabilization kept that contract and added AnalyserNode-based activity monitoring for levels + speech-energy hold.

### 2. Conversations fail to create / load

| Cause | Location | Impact |
|-------|----------|--------|
| **Demo auth JWT** (`demo-access-token`) cannot satisfy `auth.uid()` RLS | `demoAuth` + `AuthContext` + chat repos | Inserts/selects fail or return null |
| Local Supabase missing **table GRANTs** | Chat migrations | Permission denied before RLS |
| Create returning null treated as opaque Arabic error | `chatService.createConversation` | No HTTP / PostgREST diagnostics |
| `loadDetail` race with in-flight send/stream | `ChatPage.tsx` | Empty/stale detail wipe looked like “failed to load” |
| Mid-stream persist failures swallowed | `chatService.streamIntoAssistant` | Silent DB drift |

### 3. Voice interaction not ChatGPT-like

| Cause | Impact |
|-------|--------|
| Status model was `processing` only | No Listening / Thinking / Responding / Speaking progression |
| No waveform while recording | Weak recording affordance |
| Immediate hands-free commit | Felt abrupt vs ChatGPT Voice turn-taking |

---

## Fixes applied

### Microphone / STT

- Hands-free **end-of-utterance silence** (default **2500ms**, configurable `1500–5000`) — accumulates finals; does not send on first final.
- **Voice activity monitor** (`voiceActivityMonitor.ts`): `getUserMedia` + `AnalyserNode` levels; holds silence commit while speech energy present.
- Home `DEFAULT_SILENCE_MS` → **3000**; silence arms **only after first speech** (not on start).
- Web Speech `stop()` waits for `onend` (with timeout) before detaching handlers; result cursor avoids duplicate finals.
- Structured logs: `microphone`, `stt`.

### Conversation / Database

- `assertChatDatabaseAuth` blocks demo/missing JWT with clear user message before create/list/detail/send.
- `pipelineDiagnostics` exposes HTTP status, Supabase `code/details/hint`, stack, correlation/request id, user-friendly message.
- Mid-stream persist failures are logged (not silently ignored).
- Migration `20260720010000_chat_table_grants.sql` grants chat tables to `authenticated`.
- `ChatPage` detail load uses request sequencing + skips while streaming to prevent wipe races.

### AI / Streaming / TTS

- Voice turn states: **Listening → Thinking → Responding → Speaking**.
- Streaming first delta flips Thinking → Responding; TTS still drives Speaking.
- Pipeline logs for `ai`, `streaming`, `tts`, `conversation`, `database`.

### UX

- ChatGPT-like status labels in `VoiceComposer`.
- Live **waveform** while recording (`VoiceWaveform` + mic levels).
- Copy clarifying that short pauses (2–3s) will not cut recording.

---

## Validation

| Command | Result |
|---------|--------|
| `npm run typecheck` | (run in this sprint) |
| `npm run lint` | (run in this sprint) |
| `npm run test -- --run` | (run in this sprint) |
| `npm run build` | (run in this sprint) |

---

## Remaining known issues

1. **No cloud STT (Whisper) / MediaRecorder upload** — still browser Web Speech; accuracy/language coverage depends on the browser.
2. **Demo auth cannot persist chat** — by design after the auth gate; production must use real Supabase Auth.
3. **Sprint 18 realtime voice providers** remain flag-gated OFF and are stubs — not wired into ChatPage.
4. **TTS voice selection** may be empty on first Chrome speak (`speechSynthesis.getVoices()` race) — mitigated by interrupt/retry UX, not fully eliminated.
5. **TravelConversation Home seed crash** (pre-existing TDZ bug noted in `AGENTS.md`) is outside this chat voice pipeline and was not changed (no new features).

---

## Production readiness checklist

- [x] Premature hands-free cutoff mitigated (silence + VAD hold)
- [x] Configurable silence timeout
- [x] Home mic does not stop before first speech
- [x] Create/load failures diagnose auth/RLS/PostgREST with request id
- [x] Demo session blocked from DB writes with clear UX
- [x] Local GRANT migration for chat tables
- [x] Detail-load race with streaming mitigated
- [x] ChatGPT-like Listening / Thinking / Responding / Speaking
- [x] Waveform while recording
- [x] Structured pipeline logging (mic/STT/conversation/DB/AI/streaming/TTS)
- [ ] Hosted Supabase: confirm migrations applied (grants + chat schema)
- [ ] Staging: real-user E2E create → send → reload → voice PTT + hands-free
- [ ] Confirm CSP / mic permissions on target browsers (Safari iOS especially)
- [ ] Monitor production logs for `pipeline.*` error rates

---

## Key files

- `src/lib/chat/voice/voiceSession.ts`
- `src/lib/chat/voice/voiceActivityMonitor.ts`
- `src/lib/chat/voice/webSpeechToTextProvider.ts`
- `src/hooks/useSpeechRecognition.ts`
- `src/lib/chat/chatAuthGate.ts`
- `src/lib/chat/pipelineDiagnostics.ts`
- `src/lib/chat/chatService.ts`
- `src/pages/ChatPage.tsx`
- `src/components/chat/VoiceComposer.tsx`
- `src/components/chat/VoiceWaveform.tsx`
- `supabase/migrations/20260720010000_chat_table_grants.sql`
- `src/lib/__tests__/productionStabilization.test.ts`
- `src/lib/__tests__/voiceSession.test.ts`
