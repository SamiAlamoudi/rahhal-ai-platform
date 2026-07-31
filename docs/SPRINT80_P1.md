# Sprint 80 — P1 High Priority (post–Sprint 79 P0)

**Baseline:** `main` @ `00449c5` (PR #312 — Sprint 79 P0 Security Hardening)  
**Branch:** `cursor/sprint80-p1-performance-71ec`

## Scope (audit P1 slice)

| ID | Item | Status in this PR |
| --- | --- | --- |
| P1-5 | Split / memo ChatPage — isolate voice meters; memo `MessageBubble` | **Done** |
| P1-6 | Replace TTS unlock warm with preconnect/OPTIONS only | **Done** |
| P1-7 | Doc freeze alignment — voice contracts match #311 | **Done** |
| P1-2 | Close superseded drafts #301–#310 (no merge); keep #291/#294/#295 | **Ops** |
| P1-1 | Recovery Phase 2 museum deletion | Deferred (L–XL) |
| P1-3 | Unify provider path design | Deferred |
| P1-4 | Gated live flight search pilot | Deferred |

## Code changes

1. **`voiceMeterStore` + `useVoiceMeterLevel`** — mic level pub/sub so level ticks do not re-render `LegacyChatPage` / the message list.
2. **`MessageBubble`** — wrapped in `React.memo`.
3. **`unlockAudioPlayback`** — silent local unlock + `preconnectOpenAiTtsRoute()` only; no synthetic `مرحبا` TTS POST.
4. **Docs** — `ARCHITECTURE_CONVERSATION_FIRST.md` + freeze notes on voice sprint reports.

## Verify

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```
