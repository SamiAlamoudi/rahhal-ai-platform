# Migration Report — Conversation-First Architecture Reset

Branch: `cursor/openai-conversation-first-71ec`

## Goal

Remove experimental voice/preview/debug pipelines and make OpenAI ChatGPT the sole production conversation intelligence engine behind Rahhal, while Rahhal retains trip state, memory, tools, providers, UI, auth, and session ownership.

## Removed

### Experimental / parallel voice & realtime

| Item | Location |
| --- | --- |
| Sprint 18 voice conversation runtime | `src/lib/voiceConversation/**` (deleted) |
| Sprint 18 voice tests | `src/lib/__tests__/voiceConversation.sprint18.test.ts` |
| OpenAI Realtime session API | `api/openai-realtime-session.ts`, `api/_lib/openaiRealtimeEnv.ts` |
| Vite Realtime plugin | `src/lib/viteOpenAiRealtimeApiPlugin.ts` |
| Realtime docs/reports | `AI_REALTIME_VOICE.md`, `OPENAI_REALTIME_INTEGRATION_REPORT.md`, `OPENAI_REALTIME_METRICS_REPORT.md` |
| Legacy Rahhal voice template copy | `src/utils/rahhalVoice.ts` |
| Realtime Vite chunk groups | `llmBrain` / `agentRuntime` / `realtimeVoice` manual chunks |
| OpenAI Realtime CSP websocket allow | `wss://api.openai.com` (Chat Completions HTTPS retained) |

### Feature flags removed

- `ai.llm_conversation_brain`
- `ai.agent_runtime`
- `ai.realtime_voice`
- `ui.voice_conversation`
- `voice.realtime`
- `voice.provider`
- `voice.mock`

### Soft-enrich meta (deprecated / never)

- `AgentProviderMeta.llmBrain`
- `AgentProviderMeta.agentRuntime`

### Already removed earlier on this branch

- `src/lib/agent/llmBrain/**`
- `src/lib/agent/agentRuntime/**`
- `src/lib/realtimeVoice/**`
- ChatGPT-experience orchestrator / alternate conversation providers (trimmed to session UI recovery)

### Test updates

- Sprint 20–24 voice-parity cases that depended on `voiceConversation` were removed; text/pipeline assertions retained.
- RC-1 / RC-2 / RC-3 gates now assert removed Phase 5–7 flags are **absent**, not merely OFF.

## Retained (production)

| Component | Role |
| --- | --- |
| `/chat` → `chatEngine` → `travel-agent` → `planTurn` | Sole conversation spine |
| `conversationBrain` + `systemPrompt` | OpenAI dialogue + injection + response contract |
| `openaiLlmAdapter` / LLM factory | ChatGPT when API key present; local fallback otherwise |
| Travel Facts / memory / tools / providers | Rahhal trip intelligence & execution |
| `src/lib/chat/voice/*` | Production STT → chatEngine → TTS lifecycle |
| `ChatPage`, VoiceComposer, VoicePanel chrome | Product UI |
| Auth / Supabase / session recovery | Session management |
| Mock STT/TTS providers | Test/CI fallback only (not a product conversation owner) |
| Ops `previewEnvCheck` | Deployment preview env validation (not conversation runtime) |

## Architectural changes

1. **System prompt** reframed as Conversation-First: Rahhal identity, OpenAI as engine, mandatory response contract, injection framing.
2. **User payload** labels injected trip state / memory / preferences / conversation context / response contract for every OpenAI request.
3. **`speakTravelFacts`** always injects a `userProfile` block with travel preferences derived from Travel Facts.
4. **Domain shims** updated:
   - `src/domains/voice` → production `chat/voice` only
   - `src/domains/ai/prompt-engine` → Conversation Brain system prompt
5. **Presentation VoiceAdapter** remains mock chrome only; duplex I/O is exclusively `src/lib/chat/voice`.

## OpenAI selection

When `OPENAI_API_KEY` / `VITE_AGENT_OPENAI_API_KEY` / `VITE_OPENAI_API_KEY` is set (and provider is not forced to `local`), `createAgentLlmRegistry().getActive()` selects OpenAI. `runConversationBrain` calls `llm.converse()` with the injected payload; local generative model is fallback only.

## Packages

No npm dependencies were removed in this reset — realtime voice never shipped as a dedicated package; browser Web Speech APIs and OpenAI HTTP Chat Completions remain the production I/O.

## Follow-ups (non-blocking)

- Optional: token-level OpenAI streaming into chatEngine deltas (UI already streams assistant content after full converse JSON).
- Optional: inject long-term Traveler Personalization store profiles into `userProfile` when a stable user id is present.
- Historical docs under `docs/SPRINT18_*`, `RC*_*.md` still mention deleted modules for audit history; product spine docs are `ARCHITECTURE_CONVERSATION_FIRST.md` and this report.
