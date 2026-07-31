# Sprint 80 — P1-5 / P1-6 / P1-7 (post–Sprint 79 P0)

**Baseline:** `main` @ `00449c5` (PR #312 — Sprint 79 P0 Security Hardening)  
**Branch / PR:** `cursor/sprint80-p1-performance-71ec` · [#313](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/313)

## Scope (this PR only)

| ID | Item | Status |
| --- | --- | --- |
| P1-5 | Isolate voice meters; memo `MessageBubble`; honest virtualization threshold; stable `renderMessage` | **Done** |
| P1-6 | TTS unlock = silent local unlock + preconnect/OPTIONS only (no `مرحبا` POST) | **Done** |
| P1-7 | Doc/code freeze — mic IDLE after reply; `interrupt_response: false` | **Done** |

Deferred outside this PR: P1-1 museum deletion, P1-2 PR hygiene ops, P1-3 provider unify, P1-4 live flight pilot.

## Code / docs

1. `voiceMeterStore` + `useVoiceMeterLevel` — mic level pub/sub (ChatPage does not re-render on ticks).
2. `MessageBubble` — `React.memo`; ChatPage `renderMessage` stabilized via action refs.
3. `MESSAGE_LIST_VIRTUALIZE_AFTER = 40` — short chats fully mounted.
4. `unlockAudioPlayback` — no synthetic TTS warm POST.
5. `RECOVERY_VOICE_MIC_AFTER_REPLY` / `RECOVERY_VOICE_INTERRUPT_RESPONSE` in `src/lib/recovery/freeze.ts`.
6. Docs: `ARCHITECTURE_CONVERSATION_FIRST.md`, voice sprint freeze notes, `RECOVERY_AUDIT.md`, `AGENTS.md`.

## Verify

```bash
npm run lint
npm run typecheck
npm run test:run
npm run providers:check
npm run build
npm run production:verify
npm run deploy:verify
```
