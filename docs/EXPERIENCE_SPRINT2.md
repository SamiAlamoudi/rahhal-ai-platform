# Experience Sprint 2 — LLM Conversation Brain

**Goal:** The LLM drives dialogue. Travel Intelligence returns structured facts only.

## Architecture

```
User message
  → Travel Intelligence (extract, plan, tools, concierge policy)
       → TravelFacts JSON (no user prose)
  → Conversation Brain
       → system prompt + history + facts + objective
       → llm.converse()  (OpenAI when keyed, else local generative model)
       → { displayText, spokenText }
  → Chat UI + Voice TTS (spokenText only)
```

## Removed from the live reply path

| Source | What was removed from user replies |
|--------|-------------------------------------|
| `formatReply.buildFollowUpQuestion` | Form inventory / “Next question” / no-guessing banners |
| `formatReply.composeTripPlanDisplay` / spoken summaries | No longer the chat reply author |
| `formatReply.buildThinkingBridge` | Scripted voice bridge removed from provider |
| `formatReply.buildSaveAck` / `buildEditAck` | Inline hardcoded save/edit strings |
| `consultantVoice.buildConsultantReply` | Concierge no longer returns scripted prose (`reply: null`) |
| Inline AR/EN save strings in `travelAgentService` | Replaced by Conversation Brain objectives |
| `formatReasoningReply` on the agent path | Facts → Brain instead of templated discovery copy |
| Sprint 44 canned openers | `naturalLanguage` now routes through generative facts path |

Legacy helpers remain in the repo for tests/reference but are **not** used to author traveler-facing turns on the default agent path.

## Modules now controlled by the LLM (Conversation Brain)

- Follow-up questions (whether to ask, wording, tone)
- Plan presentation text + spoken summary
- Concierge-owned turns (after policy decision)
- Save / edit acknowledgements
- Reasoning/discovery presentation
- Domain booking/order/confirmation notes (rewritten via Brain)
- ChatGPT-experience openers (via generative local/facts path)

## New prompt architecture

- Single system prompt: `RAHHAL_CONVERSATION_SYSTEM_PROMPT` in `conversationBrain/systemPrompt.ts`
- User payload: objective + Travel Facts JSON + history + latest message
- Model returns JSON: `{ displayText, spokenText }`
- OpenAI: `src/lib/agent/llm/openaiLlmAdapter.ts` (`VITE_OPENAI_API_KEY` / `VITE_AGENT_OPENAI_API_KEY`)
- Offline: local `converse()` generative model seeded by conversation+facts (varied wording, not fixed scripts)

## Remaining deterministic components (Travel Intelligence)

- Requirement extraction
- Missing hard slots computation
- Trip plan / tool execution / merges
- Concierge turn policy + handoff (no prose)
- Ranking / decision engine scores (facts only)
- Feature flags, persistence, auth

## Remaining hardcoded user-facing text (if any)

- Local generative paraphrase pools (offline fallback only — not fixed conversation scripts; OpenAI replaces when keyed)
- `naturalToolFailureMessage` short recovery line (ChatGPT experience error path)
- `smartFollowUp` optional companion-type hint for ChatGPT experience
- UI chrome / buttons / status labels (not conversation turns)
- Some brain/executive composers may still exist behind flags; default `/chat` travel-agent path is Brain-driven

## Env

```
VITE_AGENT_LLM_PROVIDER=local   # or openai
VITE_OPENAI_API_KEY=...         # enables real Conversation Brain
VITE_AGENT_OPENAI_MODEL=gpt-4o-mini
```
