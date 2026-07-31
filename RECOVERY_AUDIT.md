# Rahhal AI Platform — Recovery Audit
 
**Classification:** Engineering foundation for rebuild  
**Mode:** Read-only analysis — no code changes  
**Stance:** Accuracy over optimism  

---

## Verdict

Rahhal is a **working Arabic RTL travel SPA** with auth, chat persistence, rule-based planning, mock inventory, and browser speech. It is **not** a real-time AI Travel Concierge.

What shipped is a **flag-gated product of many additive sprints**: one active chat spine buried under parallel voice stacks, orchestrators, homes, payment packages, and memory systems. Complexity grew faster than coherence.

**Bottom line:** Simplify before you sophisticate. Do not add engines. Delete and converge.

| Score | Value | Meaning |
|-------|------:|---------|
| Architecture complexity | **8 / 10** | Many parallel systems; hard mental model |
| Simplicity | **3 / 10** | Default path is understandable; repo is not |
| Production readiness | **5 / 10** | Auth + chat work; live inventory/payments weak |
| Voice readiness | **2 / 10** | Browser STT→text turn→TTS only |
| AI readiness | **4 / 10** | Strong rules/tools; no default generative duplex |
| UX readiness | **6 / 10** | Usable chat/home; premium feel incomplete |
| Travel Concierge readiness | **3 / 10** | Missing live grounding + realtime voice + one brain |

---

## 1. Folder structure

| Path | Purpose |
|------|---------|
| `src/main.tsx` | App entry, router, auth shell |
| `src/pages/` | Lazy route screens (`ChatPage`, Home, booking, checkout) |
| `src/components/` | Presentational UI (chat, home; unused voice/brain chrome) |
| `src/lib/` | **Real system** (~6.7 MB): chat, agent, brain, booking, payment, ops |
| `src/domains/` | Thin DDD façades over `lib/` — incomplete migration |
| `src/utils/` | Legacy engines (session, search, scoring) — misnamed “utils” |
| `src/integrations/` | Provider adapters (Amadeus, Booking, Maps, Weather) |
| `src/ui/` | Premium / production-integration presentation (mostly flag-gated) |
| `src/hooks/` | Speech + **unused** voice/brain hooks |
| `src/core/` | Decision/search gateway cores |
| `api/` | Vercel Edge: Amadeus token, provider health |
| `supabase/` | Migrations, RLS, Edge Functions (maps, weather, Moyasar, Amadeus) |
| `scripts/`, `e2e/`, `docs/`, `documentation/` | Tooling, Playwright smoke, dual doc trees |

**Judgment:** `src/lib` is the product. `domains/` is aspirational. `utils/` and half of `lib/agent` are historical sediment.

---

## 2. Application entry point

```text
index.html
  → main.tsx
    → runStartup (ops validation + global handlers)
    → StrictMode
    → AppErrorBoundary
    → BrowserRouter
    → AuthProvider
    → Suspense(RouteSkeleton)
    → Routes (almost all React.lazy)
```

**Import-time hard dependency:** `supabaseClient` creates the client at module load — needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` or the app throws.

**Default route branching:**

- `/` → `AiHomeExperience` (`ui.ai_home` ON) unless `ui.production_integration` forces Production Home  
- `/chat` → **LegacyChatPage** unless production integration ON  

Authenticated users on public routes redirect to `/chat`.

---

## 3. Message flow (one user message)

**Default path only** (`ui.production_integration` OFF):

```text
User types / speaks
  → ChatPage (LegacyChatPage)                 src/pages/ChatPage.tsx
  → optimistic local user bubble + preview
  → chatEngine.sendMessage                   src/lib/chat/chatEngine.ts
  → chatService.sendUserMessage              src/lib/chat/chatService.ts
      → chatAuthGate (Supabase session)
      → messageRepository / localChatStore
      → insert user + streaming assistant row
  → chatProviderFactory → travel-agent       src/lib/chat/chatProviderFactory.ts
  → travelAgentProvider.streamReply          src/lib/agent/travelAgentProvider.ts
  → travelAgentService.planTurn              src/lib/agent/travelAgentService.ts (~2850 LOC)
      → flag-gated enrichers (concierge, reasoning, intel, packages…)
      → compose full reply text (+ meta)
  → provider fake-streams characters
  → chatService onDelta / onComplete
  → ChatPage delta coalescer
  → MessageBubble render                     src/components/chat/MessageBubble.tsx
```

**State:** Conversation list + messages live in **ChatPage React state**, not a global ConversationProvider. Persistence is Supabase (real JWT) or `localChatStore` (demo / auth failure).

**Critical honesty:** “Streaming” is **theatrical** — the full reply is composed first, then chunked for UI. This is not LLM token streaming.

**Alternate (flag ON):** `ProductionConversationScreen` → `uiIntegration/conversationTurn` → `agent/streaming` → `agent/pipeline` — **bypasses** `chatEngine` entirely. A second product.

---

## 4. Voice flow

```text
Mic permission → getUserMedia (retained for VAD)
  → Web Speech STT (or unsupported / mock in tests)
  → voiceSession silence / VAD
  → transcript string
  → chatEngine.sendMessage({ modality: 'audio', audioUrl: null })
  → same planTurn path as text
  → speechSynthesis TTS of short spoken summary
```

| Concern | Reality |
|---------|---------|
| Microphone | Works with permission + HTTPS/localhost |
| Speech recognition | Browser Web Speech only (Chrome/Edge-class) |
| Conversation | Transcript becomes a normal chat turn |
| Streaming | No audio stream to a model |
| TTS | Browser `speechSynthesis` after reply |
| Interruptions | Stop TTS / abort STT; no barge-in over neural audio |
| Memory | Same chat DB as text; no voice-session memory |
| Realtime | **None** — no WebRTC, no MediaRecorder upload |
| Parallel stack | `lib/voiceConversation` + unused hooks/components — **dead to routes** |

> **Production freeze (Sprint 80 / post-#311):** Mic returns **IDLE** after assistant reply/playback (no auto-relisten). Realtime `interrupt_response` is **false**. Home Realtime is STT + speak-written-draft over the same `planTurn` spine — see `docs/ARCHITECTURE_CONVERSATION_FIRST.md` and `src/lib/recovery/freeze.ts` (`RECOVERY_VOICE_*`). Historical rows above that predate Home Realtime should be read through that freeze.

**Home mic** (`useSpeechRecognition`) only fills the composer draft. It does not open a voice session.

**Limitation statement:** Voice today is **dictation into a rule engine**, not a realtime concierge call.

---

## 5. AI architecture

Named concepts vs what they actually are:

| Name | What it is |
|------|------------|
| Conversation Brain | Local reply authoring inside agent (`conversationBrain`) and/or experimental `lib/brain` |
| Planner | Flag-gated trip/itinerary builders inside `planTurn` |
| Travel Agent | **`travelAgentService.planTurn`** — the real center of gravity |
| Decision Layer | Scoring/decision modules + utils engines; partially overlapping |
| Prompt Builder | Formatters / persona strings — not a cloud prompt pipeline |
| Memory | Multiple: agent memory, brain memory, PreferenceEngine, optional chatgpt window |
| Context | Message history from DB (re-fetched on send, limit 500) |
| Pipeline | Sprint 115 `agent/pipeline` (production UI path) |
| Streaming | Fake char stream **or** separate `agent/streaming` wrapper |
| Factory | `chatProviderFactory` picks travel-agent / conversation-ui / chatgpt / mock |
| Orchestrator | At least four: planTurn, ConversationController, chatgpt experience, aiOrchestrator, brain orchestrator |
| Execution Pipeline | **Two** near-copies (Sprint 113 orchestrator vs 115 pipeline) |

**How they communicate:** Defaults collapse to **one call**: ChatPage → chatEngine → travelAgentProvider → `planTurn`. Most other “orchestrators” are behind OFF flags or unused UI. The architecture *diagram* is richer than the *runtime*.

```text
                    ┌── conversationExperience (OFF)
Chat UI ──chatEngine─┤── chatgptExperience (OFF)
                    └── travel-agent (ON) ── planTurn ──┬── concierge / intel flags
                                                       └── brain.* (mostly OFF)
Production UI (OFF) ── streaming ── pipeline (separate spine)
```

---

## 6. Authentication

```text
Login / SignUp / Demo
  → authService
  → supabase.auth  OR  demoAuth (localStorage fake JWT)
  → AuthContext (memoized value)
  → ProtectedRoute / PublicOnlyRoute / AdminRoute
```

- Real sessions use Supabase Auth.  
- Demo sessions **cannot** satisfy RLS → chat falls back to local storage.  
- Admin is SPA-side (`app_metadata.role` or `VITE_ADMIN_USER_IDS`) — not a hard server gate for admin UI.  
- Cold start blocks UI until `getSession()` resolves.

---

## 7. Supabase architecture

- **Auth + Postgres + RLS** for conversations/messages and booking/checkout tables.  
- **Edge Functions:** Amadeus token, Maps proxy, OpenWeather proxy, Moyasar payment/webhook, ops-health.  
- **Client:** single anon key client; repositories under `lib/repositories/*`.  
- **Local gotcha:** migrations create RLS without table GRANTs → local reads/writes silently fail unless manually granted.  
- **Dual persistence:** remote rows merged with `localChatStore` — necessary for demo, dangerous for mental models in production.

---

## 8. API architecture

Thin server surface:

| Surface | Role |
|---------|------|
| `api/amadeus-token.ts` | OAuth token for Amadeus (secrets off client) |
| `api/health/providers.ts` | Provider health |
| Supabase Edge proxies | Maps, weather, payments |

Most “API” work is **client → Supabase** or **client → mock adapters**. Live travel search is not the default runtime path.

---

## 9. Conversation architecture

**Sources of truth (problem):**

1. **Primary:** `conversations` + `messages` via `chatService` / repositories  
2. **Fallback:** `localChatStore`  
3. **Legacy:** `utils/travelSession` on `/travel-conversation` and search  
4. **Gated:** in-memory Production Conversation lines (no chatEngine)

UI conversation state is page-local. There is no durable realtime channel. Seed-from-home navigates into `/chat` and creates/sends through the primary path (with optimistic create on current branch).

---

## 10. Performance bottlenecks

1. **`planTurn` completes before first visible token** — perceived AI lag.  
2. **Every send re-lists message history** from DB (up to 500).  
3. **Auth `getSession` on startup and chat DB ops.**  
4. **Fat ChatPage (~1309 LOC) + fat agent service (~2850 LOC) + large JS chunks.**  
5. **StrictMode double effects in development.**  
6. Mitigated recently: post-turn full conversation list refresh; optimistic create; home parallel fetch; voice-level render isolation.

---

## 11. Technical debt (honest)

- Dual conversation SoTs (chat vs travelSession).  
- Dual voice stacks.  
- Dual/triple payments (`payment` live path vs `payments` / `finance` experiments).  
- Dual execution engines + dual ExecutionPipelines.  
- Orchestrator sprawl.  
- Incomplete `domains/` adoption (UI still deep-imports `lib/`).  
- Feature-flag archaeology as a substitute for deletion.  
- Theatrical streaming marketed as streaming.  
- Silent fallbacks that hide broken persistence.  
- SPA-only admin authorization.

---

## 12. Duplicate responsibilities

| Area | Duplicates |
|------|------------|
| Voice | `lib/chat/voice` vs `lib/voiceConversation` |
| Home | AI Home vs Legacy vs Production |
| Chat turns | chatEngine spine vs Production pipeline spine |
| Orchestration | planTurn / ConversationController / chatgpt / brain / aiOrchestrator |
| Memory | agent / brain / preferences / chatgpt window |
| Payments | `lib/payment` vs `lib/payments` vs `lib/finance` |
| Search | utils orchestrators vs agent live search vs brain search |

---

## 13–15. Dead code, unused folders, unused services

**Dead to product routes (safe to treat as delete candidates):**

- `src/hooks/useVoice*.ts`, `useConversationBrain`, `useConversationMemory`, `useTravelContext`  
- `src/components/voice/*`, `src/components/brain/*`  
- Route-unused Sprint 18 voice foundation **as a product path** (`lib/voiceConversation` kept only by tests/façades)

**Effectively unused at default flags:**

- `ui/integration` Production Conversation/Home  
- `lib/aiOrchestrator`, chatgpt experience, conversation experience UI  
- `lib/payments`, `lib/finance` (experiments)  
- Large OFF `brain.*` surface area

**Not dead:** `utils/rahhalVoice.ts` (legacy TravelConversation), `lib/chat/voice` (real chat voice), `lib/payment` (checkout).

**Unused / redundant trees:** second docs folder (`documentation/` vs `docs/`); domain façades that nobody prefers over `lib/`.

---

## 16. Feature flags

**Count:** ~**118** registered flags — roughly **62 ON / 56 OFF**.

**Why they exist:** Incremental sprint delivery without deleting prior paths. They became a **museum of unfinished products**.

| Keep (product spine) | Remove or freeze-then-delete |
|----------------------|------------------------------|
| Auth/booking/checkout essentials that gate real UX | Stacked `brain.*` never piloted |
| A **small** set of live-provider masters (one master + per-provider) | Duplicate provider flags (`provider.amadeus` vs `providers.amadeus.enabled` vs `ai.live_*`) |
| One voice capability flag (future cloud voice) — not three | `ui.voice_conversation` + `voice.*` + `brain.voice` overlap |
| | `ui.production_integration` **or** legacy chat — not both forever |
| | ChatGPT / conversation-experience / ai_orchestrator until one UX is chosen |

**Rule:** If a flag has been OFF since merge and has no staging pilot, it is debt, not strategy.

---

## 17–18. Complexity & simplicity scores

**Complexity 8/10:** Multiple SoTs, multiple orchestrators, 118 flags, dual homes/chats/voices/payments. Onboarding a senior engineer to “how does one message work?” takes hours, not minutes.

**Simplicity 3/10:** The *happy path* is a straight line (ChatPage → chatEngine → planTurn). The *repository* refuses to look like that line. Simplicity was sacrificed to preserve every experiment.

---

## 19–23. Readiness scores

| Dimension | Score | Why |
|-----------|------:|-----|
| Production | **5** | Login/chat/Supabase work; mock payments; live providers opt-in; local grants footgun |
| Voice | **2** | Dictation + browser TTS; no duplex; Firefox-class browsers fail STT |
| AI | **4** | Capable rule/tool agent; not a default LLM concierge; fake streaming |
| UX | **6** | Arabic RTL chat usable; premium polish uneven; dual UIs confuse direction |
| Travel Concierge | **3** | Missing live inventory as default, realtime voice, single memory, single brain |

---

## CRITICAL — Top 10 engineering problems

### 1. No single conversation source of truth
- **Impact:** Bugs, dual UX, impossible “concierge memory.”  
- **Evidence:** chat DB + localChatStore + travelSession + Production in-memory lines.  
- **Fix:** One SoT (`conversations`/`messages`); migrate or delete legacy intake.  
- **Difficulty:** Hard  

### 2. Orchestrator sprawl around one real brain
- **Impact:** Nobody knows which engine owns a turn; changes regress silently.  
- **Evidence:** planTurn vs ConversationController vs chatgpt vs brain vs aiOrchestrator vs two pipelines.  
- **Fix:** Declare `planTurn` (or one successor) as sole turn owner; delete/unwire the rest.  
- **Difficulty:** Hard  

### 3. Feature-flag museum (~118)
- **Impact:** Combinatorial testing impossible; “defaults” hide dead products.  
- **Evidence:** `featureRegistry.ts` 62/56 split; many OFF forever.  
- **Fix:** Cap flags; delete unused modules behind OFF flags.  
- **Difficulty:** Medium  

### 4. Voice is not realtime AI conversation
- **Impact:** Product promise ≠ architecture.  
- **Evidence:** Web Speech → text `planTurn` → speechSynthesis; `audioUrl: null`; Sprint 18 unwired.  
- **Fix:** Either market as voice *input* or replace with cloud STT/TTS + duplex session — after simplification.  
- **Difficulty:** Hard (capability); Easy (honest positioning)  

### 5. Theatrical streaming
- **Impact:** Latency floor = full planTurn; UX lies about “streaming.”  
- **Evidence:** `travelAgentProvider` chunks completed text.  
- **Fix:** Stream progressive status events honestly; defer true LLM streaming until one AI spine exists.  
- **Difficulty:** Medium  

### 6. Dual (or triple) product UIs for the same job
- **Impact:** Split polish effort; flags flip entire stacks.  
- **Evidence:** Legacy chat vs Production conversation; three homes.  
- **Fix:** One home, one chat shell.  
- **Difficulty:** Medium  

### 7. Fat modules (`ChatPage`, `travelAgentService`)
- **Impact:** Slow builds, high regression risk, impossible ownership.  
- **Evidence:** ~1309 and ~2850 LOC; historical ~569 kB chat chunk debt.  
- **Fix:** Split UI chrome from turn orchestration; extract planTurn stages as pure modules *without* new engines.  
- **Difficulty:** Medium  

### 8. Send path re-fetches full history
- **Impact:** Unnecessary network/DB on every message.  
- **Evidence:** `chatService` lists messages before stream.  
- **Fix:** Pass in-memory history already loaded by UI.  
- **Difficulty:** Easy–Medium  

### 9. Dual payments / dual execution
- **Impact:** Wrong package imports; checkout confusion.  
- **Evidence:** `lib/payment` vs `payments` vs `finance`; dual execution packages.  
- **Fix:** One payment implementation; delete experiments.  
- **Difficulty:** Medium  

### 10. Silent persistence / demo dual path
- **Impact:** “Chat works” while Supabase writes fail unnoticed.  
- **Evidence:** local fallback; local GRANT gotcha; swallowed errors.  
- **Fix:** Explicit degraded mode UI; fail loud in non-demo; fix grants in local tooling.  
- **Difficulty:** Easy–Medium  

---

## Recovery roadmap (5 phases max)

**Principle:** Simplify the existing architecture. Do **not** add new AI engines.

### Phase 1 — Tell the truth & freeze
- Document the single default path (ChatPage → chatEngine → planTurn).  
- Freeze OFF experimental flags; ban new flags without deleting an old one.  
- Rename product language: voice = “voice input,” not “realtime concierge,” until architecture matches.

### Phase 2 — Delete dead weight
- Remove unused voice/brain hooks and unmounted components from the product tree (or quarantine behind a clearly abandoned path).  
- Choose: keep Legacy chat **or** Production conversation — delete the other wiring.  
- Delete or archive unused payment/finance/orchestrator experiments not on the default path.

### Phase 3 — One conversation SoT
- Route all intake through `/chat` + Supabase messages.  
- Retire or thin `/travel-conversation` + `travelSession` as SoT.  
- Make demo vs remote persistence explicit in UX.

### Phase 4 — One turn owner, honest performance
- Collapse turn ownership to a single module (`planTurn` or a slimmed rename — not a new engine).  
- Stop re-listing history on send; keep optimistic UI.  
- Replace theatrical streaming with honest progressive status until a real stream exists.

### Phase 5 — Concierge readiness prerequisites
- One memory/preferences pipeline for the turn owner.  
- One live-provider gateway path (mock default remains OK).  
- Only then: cloud speech + duplex realtime as an **extension of the single spine**, not a seventh stack.

---

## Closing

Rahhal’s failure mode is not “too little AI.” It is **too many unfinished AIs**.

The platform already has a viable spine: **authenticated chat, persisted messages, rule-based travel agent, browser voice input.** Recovery means protecting that spine and deleting everything that pretends to be a second platform.

Rebuild the concierge on **simplicity**, not on another orchestrator.

---

*End of audit. No code was modified.*
