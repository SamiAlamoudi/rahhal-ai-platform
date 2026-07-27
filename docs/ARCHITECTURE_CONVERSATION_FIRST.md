# Conversation-First Architecture

Rahhal (رحّال) is a Conversation-First AI Travel Consultant.
**Rahhal remains the product.** OpenAI ChatGPT is the intelligence and speaking engine behind Rahhal.

## Responsibility split

| Owner | Responsibilities |
| --- | --- |
| **Rahhal** | Trip State, Memory, Conversation Context, Tool Execution, Travel Providers, UI, Authentication, User Profile, Session Management |
| **OpenAI ChatGPT** | Thinker, Planner (dialogue), Conversation engine, Speaker (spokenText), Travel consultant language |

Before every OpenAI request, Rahhal injects:

1. Current trip state / Travel Facts
2. Memory
3. Travel preferences
4. Conversation context (recent turns + objective)
5. Response contract (Advance / Collect / Recommend / Confirm / Execute)

## Production pipeline

```text
Microphone
    ↓
Speech-to-Text          (src/lib/chat/voice/webSpeechToTextProvider)
    ↓
Conversation Context    (chatEngine + Travel Facts + memory + preferences + response contract)
    ↓
OpenAI ChatGPT API      (conversationBrain → openaiLlmAdapter.converse)
    ↓
Assistant Response      (displayText + spokenText JSON)
    ↓
Text-to-Speech          (src/lib/chat/voice/webTextToSpeechProvider)
    ↓
Listening               (hands-free resume / barge-in interrupt)
```

Text turns skip Mic/STT/TTS and enter at Conversation Context.

## Module map

```mermaid
flowchart TB
  subgraph UI["Rahhal UI"]
    ChatPage["/chat ChatPage"]
    VoiceUI["VoiceComposer / VoicePanel"]
  end

  subgraph Voice["Production voice — src/lib/chat/voice"]
    STT["Speech-to-Text"]
    Session["voiceSession"]
    TTS["Text-to-Speech"]
  end

  subgraph Spine["Conversation spine"]
    Engine["chatEngine"]
    Provider["travel-agent provider"]
    PlanTurn["travelAgentService.planTurn"]
  end

  subgraph RahhalCore["Rahhal owns"]
    TripState["Trip State / Travel Facts"]
    Memory["Memory"]
    Prefs["Preferences / Profile"]
    Tools["Tool Execution"]
    Providers["Travel Providers"]
    Auth["Auth / Session"]
  end

  subgraph Brain["Conversation Brain"]
    Inject["Context injection + response contract"]
    OpenAI["OpenAI ChatGPT converse()"]
    Local["Local fallback model"]
  end

  ChatPage --> Engine
  VoiceUI --> Session
  Session --> STT
  STT --> Session
  Session --> Engine
  Engine --> Provider
  Provider --> PlanTurn
  PlanTurn --> TripState
  PlanTurn --> Memory
  PlanTurn --> Prefs
  PlanTurn --> Tools
  PlanTurn --> Providers
  PlanTurn --> Inject
  Inject --> OpenAI
  OpenAI -.->|unavailable / error| Local
  Inject --> Engine
  Engine --> Session
  Session --> TTS
  TTS --> Session
  Auth --> Engine
```

## Canonical code paths

| Concern | Path |
| --- | --- |
| Chat UI | `src/pages/ChatPage.tsx` |
| Turn owner | `travelAgentService.planTurn` |
| Dialogue author | `src/lib/agent/conversationBrain/` |
| OpenAI adapter | `src/lib/agent/llm/openaiLlmAdapter.ts` |
| LLM factory | `src/lib/agent/llm/factory.ts` (OpenAI when key present) |
| System prompt + injection | `src/lib/agent/conversationBrain/systemPrompt.ts` |
| Voice session | `src/lib/chat/voice/voiceSession.ts` |
| Trip / memory facts | `src/lib/agent/conversationBrain/travelFacts.ts`, `src/lib/agent/memory.ts` |

## Voice product requirements (production)

- Natural conversation via short `spokenText`
- Streaming assistant UI via chatEngine deltas
- Interruptions / barge-in via `voiceSession.interrupt`
- Automatic microphone recovery via permission + hands-free restart
- Continuous conversation (hands-free listen → think → speak → listen)

## Explicitly out of product spine

- OpenAI Realtime duplex sockets
- Sprint 18 `voiceConversation` orb runtime
- Phase 5 `llmBrain` / Phase 6 `agentRuntime` soft-enrich
- Voice Preview / Trace / Debug Overlay / JSON evidence panels
- Mock duplex “live” voice adapters as product conversation owners
