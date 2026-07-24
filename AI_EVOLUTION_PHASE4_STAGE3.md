# AI Evolution — Phase 4 Stage 3

## Premium Voice Conversation Center

| Field | Value |
|-------|-------|
| Flag | `ui.voice_center` |
| Default | **OFF** |
| Depends on | `ui.application_shell` |
| Package | `src/ui/voiceCenter/` |
| Production wiring | **None** |
| Inside Chat | **No** — own destination |
| Runtime Coordinator | **Not wired** |
| Conversation Orchestrator | **Not wired** |
| TTS / STT | **Not wired** |
| Speech vendors | **None** (placeholders only) |

### Delivered

- Immersive full-screen Voice Center UI  
- Session states + controls + shortcuts  
- Mic / wave / idle / listening / thinking / speaking animations  
- Transcript + personality + settings placeholders  
- Voice session history (separate from Chat)  
- Isolation docs + component / interaction / animation guides  
- New tests only  

### Explicit non-goals

No merge · no prior-PR edits · no speech recognition/synthesis · no Whisper/ElevenLabs/OpenAI/Azure/Google · no streaming realtime · no AI/backend.

### Validation commands

```bash
npm run lint
npm run typecheck
npm run arch:circular
npm run test:run
```

See `AI_VOICE_CENTER_VALIDATION.md`.
