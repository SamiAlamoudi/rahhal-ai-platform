# PRODUCT AUDIT — Why Rahhal Does Not Feel Like ChatGPT Voice

**Status:** Measurement-only. No fixes in this document’s accompanying change.  
**Date:** 2026-07-20  
**Scope:** Production `/chat` path (default) + voice session + provider flags.  
**Method:** Static pipeline instrumentation from source constants, state machines, provider wiring, and existing tests — not guesswork.

---

## Executive verdict

Rahhal does not feel like ChatGPT Voice because it is **not the same product class**.

| Layer | ChatGPT Voice | Rahhal (default `/chat`) |
|-------|---------------|---------------------------|
| Language model | Real generative LLM, streamed tokens | Rule engines + template strings; remote LLM adapters `isAvailable: () => false` |
| Speech input | Continuous duplex / smart endpointing | Browser Web Speech + energy VAD; default **push-to-talk** |
| Speech output | Neural TTS overlapping generation | `window.speechSynthesis` **after** full reply |
| Streaming | True model TTFT | Fake character chunking of already-complete text |
| “ChatGPT experience” | Always on | Feature flag `ui.chatgpt_experience` **default OFF** |
| Memory | Model context + learned preferences | Slot/`providerMeta` rebuild + rolling window of 12 |

The gap is not missing polish. It is **missing generative dialogue, duplex voice, and streaming audio**. Sprint 44 docs claim ChatGPT-quality goals while shipping rule-based guts with the UX flag off.

---

## Pipeline map (what actually runs)

```
User taps mic (ChatPage default: push_to_talk)
  → microphonePermission (Permissions API + getUserMedia probe)
  → voiceActivityMonitor (2nd getUserMedia + AnalyserNode RMS)
  → webSpeechToTextProvider (browser SpeechRecognition — no MediaRecorder, no Whisper)
  → silence timer (hands-free only: 2500ms default) OR PTT release
  → chatEngine.sendMessage(modality:'audio', audioUrl:null)   ← text only
  → chatProviderFactory → travel-agent (default)
       → travelAgentService.planTurn (full reply computed)
       → streamText(chunk=24, delay=8ms)   ← theatrical stream
  → MessageBubble / Markdown render
  → onComplete → webTextToSpeechProvider (speechSynthesis of full stripped markdown)
  → idle → (hands-free only) reconnect listening
```

**Not in the production path:** MediaRecorder, audio encoding, Whisper/cloud STT, realtime duplex, OpenAI/Anthropic/Gemini LLM, neural TTS, Sprint 18 `voiceConversation` orb (flag OFF).

---

## Measured constants (code truth)

### Voice / STT / silence

| Constant | Value | Source |
|----------|-------|--------|
| Default input mode | `push_to_talk` | `ChatPage.tsx` |
| Hands-free silence | **2500 ms** (clamp 1500–5000) | `voiceTypes.ts` |
| Home composer silence | **3000 ms** | `useSpeechRecognition.ts` |
| Max home listen | **60_000 ms** | `useSpeechRecognition.ts` |
| STT `stop()` hang safety | **800 ms** | `webSpeechToTextProvider.ts` |
| WebKit STT restart delay | **160 ms** | `useSpeechRecognition.ts` |
| VAD speech threshold (RMS) | **0.015** | `voiceActivityMonitor.ts` |
| VAD sample interval | **50 ms** | `voiceActivityMonitor.ts` |
| VAD FFT | 512, smoothing 0.7 | `voiceActivityMonitor.ts` |
| Audio blob / encoding | **none** (`audioUrl: null`) | `voiceSession.ts` |

### Streaming theater (after full reply exists)

| Provider | Chunk size | Delay | Source |
|----------|------------|-------|--------|
| travel-agent (default) | 24 chars | 8 ms | `travelAgentProvider.ts` |
| conversation-ui | 28 chars | 6 ms | `StreamingResponse.ts` (“Fake-token streaming”) |
| chatgpt-experience | 16–22 chars | 3–4 ms | `experienceOrchestrator.ts` |
| mock | 18 chars | 16 ms | `mockChatProvider.ts` |
| Mid-stream DB persist | every ≥120 chars | `chatService.ts` |

### Memory windows

| Store | Limit | Source |
|-------|-------|--------|
| ChatGPT memory rolling window | **12** messages | `memoryManager.ts` |
| Tool result memory | **8** | `memoryManager.ts` |
| Summarizer recent window | 6 / summarize after 12 | Sprint 28 types |
| Travel-agent memory rebuild | last assistant `providerMeta` only | `memory.ts` |

### Feature flags (shipped defaults)

| Flag | Default | Effect if ON |
|------|---------|--------------|
| `ui.chatgpt_experience` | **OFF** | Prefer chatgpt-experience provider |
| `ui.conversation_experience` | **OFF** | Sprint 42 cards/timeline |
| `brain.conversation_ui` | **OFF** | conversation-ui provider path |
| `ui.voice_conversation` | **OFF** | Sprint 18 orb (architecture only) |
| `voice.realtime` | **OFF** | Realtime stubs; no network I/O |

Default provider when flags OFF: **`travel-agent`** (`chatProviderFactory.ts`).

---

## Latency budget (derived — no live A/B yet)

These are **code-imposed floors**, not lab measurements against ChatGPT.

| Stage | Average floor (code) | Worst-case (code) | Notes |
|-------|----------------------|-------------------|-------|
| Mic permission | 0–50 ms if granted | User-bound / deny | Probe opens then stops tracks |
| VAD + STT start | ~50–300 ms + browser STT | Double `getUserMedia` contention | Two mic pipelines |
| Thinking pause before commit (HF) | **2500 ms** after last energy/final | 5000 ms max | Commits thinking pauses as “done talking” |
| PTT release → STT stop | 0–800 ms | 800 ms timeout | Hang safety |
| First real token | **After full `planTurn`** | Tools/search path | No incremental LLM |
| Fake first delta | +0–8 ms after planTurn | — | Then theater delay |
| Fake stream duration | `ceil(N/24)*8` ms | Long itinerary ≈ **1–3+ s** | Blocks TTS start |
| First audio | **After stream complete** | Full reply + TTS queue | No sentence-level TTS |
| Hands-free resume | After TTS `onend` | Browser STT restart + clear buffer | Gap before next listen |

**Illustrative theater delay** (travel-agent, after reply already exists):

| Reply length | Artificial stream delay |
|--------------|-------------------------|
| ~200 char follow-up | ≈ 72 ms |
| ~800 char reply | ≈ 272 ms |
| ~3000 char itinerary dump | ≈ 1000 ms |
| ~6000 char plan + decision engine | ≈ 2000 ms |

ChatGPT Voice: first audio often starts while generation continues. Rahhal: **zero audio until the last fake chunk finishes**.

---

## Stage-by-stage audit

### 1. Microphone / permission

| Metric | Finding |
|--------|---------|
| Failure modes | deny → `error`; unsupported Permissions API → probe |
| Retry | Manual re-tap; no automatic recovery UX beyond re-request |
| Pain | First-grant friction; status `requesting_permission` |

**vs ChatGPT:** Similar permission gate; ChatGPT then stays in a single continuous session.

### 2. MediaRecorder / encoding

| Metric | Finding |
|--------|---------|
| Present? | **No.** Comment in VAD: deliberately not MediaRecorder |
| Dropped audio | 100% of raw audio discarded; only transcript text stored |
| Failure rate of encode | N/A |

**Impact:** Cannot re-transcribe, cannot ship audio to cloud STT, cannot debug STT errors with waveform.

### 3. VAD

| Metric | Finding |
|--------|---------|
| Algorithm | Energy RMS gate, not ML VAD |
| Threshold | 0.015 — sensitive to noise / quiet speech |
| Role | Holds silence timer while “speaking”; drives waveform |
| Dropped events | If `getUserMedia` fails, VAD silently no-ops; silence still runs on STT partials only |

**Why pauses terminate recording:** Hands-free commits after `silenceTimeoutMs` once VAD says not speaking **and** STT finals idle. A natural mid-sentence think (>2.5s) ends the turn. ChatGPT Voice endpointing is adaptive and duplex; Rahhal is a fixed timer on a half-duplex turn machine.

### 4. Recording / STT

| Metric | Finding |
|--------|---------|
| Engine | Browser `SpeechRecognition` / `webkitSpeechRecognition` |
| Cloud STT | None |
| Early stop | Browser `onend` in hands-free → `maybeResumeHandsFree` → `startListening` **clears `utteranceBuffer`** |
| Partial UX | Partials shown; finals overwrite buffer with provider cumulative text |
| `no-speech` | Mapped to user error string |
| Locale | `ar-SA` / `en-US` only |

**Why recording feels like it stops early:**

1. Web Speech ends sessions unpredictably (especially Safari); resume clears utterance buffer → lost mid-thought speech.  
2. Default mode is PTT — release ends capture immediately (by design, but unlike ChatGPT continuous).  
3. Hands-free 2.5s silence is shorter than many users’ thinking pauses.  
4. No barge-in listen-while-assistant-speaks; interrupt is explicit stop.

### 5. Transcript → conversation

| Metric | Finding |
|--------|---------|
| Payload | `content` text, `modality: 'audio'`, `audioUrl: null` |
| Context sent | Full DB message list to provider |
| Cancellation | AbortController on send; interrupt aborts STT/TTS/stream |

### 6. Prompt construction / “LLM”

| Metric | Finding |
|--------|---------|
| System prompt | **None** (no chat-completions API) |
| Default brain | `planTurn` → slot extraction → `buildFollowUpQuestion` or `formatTripPlanReply` |
| Local LLM | Stub draft only; `assistantHint: null` |
| OpenAI/Anthropic/Gemini/DeepSeek | Registered stubs, **unavailable** |
| Intent | Regex rules (`intentClassifier`: “no LLM”) |

**Evidence — robotic follow-up template** (`formatReply.ts`):

> «سأبني خطة سفر ذكية — لكن أحتاج تفاصيل أكثر قبل التوليد (بدون تخمين).»  
> then inventory bullets + «سؤال التالي:»

**Evidence — robotic plan dump:** fixed `##` / `###` sections including Summary, Budget, Daily itinerary, Flights, Hotels, **Decision engine scores**, packing, visa notes.

Even Sprint 44 “natural language” is **canned openers** keyed by intent (`naturalLanguage.ts`), and that path is flag-gated OFF.

### 7. Streaming

| Metric | Finding |
|--------|---------|
| Incremental model tokens? | **No** |
| When first delta fires | After entire reply string exists |
| UI blocking | Fake delays intentionally slow paint; rAF coalesce in `streamUi.ts` helps paint, not TTFT |
| Persist lag | Mid-stream writes every 120 chars (non-blocking) |

Comment in code: `StreamingResponse.ts` — **“Fake-token streaming”**.

### 8. TTS / playback

| Metric | Finding |
|--------|---------|
| Engine | `speechSynthesis` + first matching `ar`/`en` voice |
| Rate / pitch / neural voice | **Not set** |
| Start time | `onComplete` only — after full text stream |
| Markdown | Stripped then spoken (headers/scores become awkward speech) |
| Overlap with generation | **None** |
| Listen while speaking | **None** (half-duplex) |

### 9. Interruption

| Metric | Finding |
|--------|---------|
| Mechanism | Explicit `interrupt()`: stop TTS, abort STT, abort stream |
| Duplex barge-in | Not in production Chat voice path |
| Resume | Optional hands-free resume after interrupt if was sending |
| Sprint 18 barge-in SM | Exists under flag OFF; “no realtime, no TTS audio” |

**vs ChatGPT Voice:** Continuous listening + barge-in mid-sentence. Rahhal: turn-based with a stop button.

### 10. Memory / next turn

| Metric | Finding |
|--------|---------|
| Short-term | Messages in DB; agent slots from last assistant meta |
| Long-term | Preference profiles (localStorage) when persistent memory ON — taste only |
| Trimming | Rolling 12 on chatgpt path; travel-agent uses full history but understands via slots |
| Repeated questions | Follow-up builder always asks `missing[0]`; soft prefs may reduce asks when Sprint 46 ON, but voice/prose still templated |
| Weak memory feel | Free-form dialogue is not understood; only extracted fields + meta survive as “memory” |

---

## Why chat feels robotic (ranked causes)

1. **No generative model on the default path** — templates and itinerary reports.  
2. **Follow-ups are form wizards** — “Next question:” + field inventory.  
3. **Plan replies are structured documents** — including “Decision engine” score dumps spoken by TTS.  
4. **Fake streaming** — theatrical typing after the answer already exists.  
5. **ChatGPT-experience flag OFF** — even that layer is canned openers + tools, not GPT.  
6. **Regex intent** — keyword routing, not understanding.  
7. **Memory is slots, not conversation** — users re-explain nuance; system re-asks hard fields.

---

## Why voice feels unlike ChatGPT Voice (ranked causes)

1. **Half-duplex turn machine** — listen XOR speak; no continuous duplex.  
2. **TTS after full reply** — multi-second dead air on long plans.  
3. **Browser TTS quality** — robotic Arabic/English system voices.  
4. **Browser STT fragility** — early `onend`, buffer clear on resume, no audio fallback.  
5. **Fixed 2.5s endpointing** — thinking pauses cut users off.  
6. **Default PTT** — not always-on voice mode.  
7. **Double mic open** (permission/VAD + Web Speech) — start latency + flaky permission states.  
8. **Speaking markdown reports** — sounds like reading a PDF.

---

## Observability gap (honesty about “Measure”)

Existing diagnostics:

- `pipelineDiagnostics.ts` — stage events (permission, listening, first_delta, speak_start/done, interrupt).  
- `experienceLogger.ts` — TTFT marks on chatgpt-experience path only.  
- No product dashboard of p50/p95 mic→transcript→TTFT→TTFA (time-to-first-audio).  
- No production counters for silence commits, STT `onend` resumes, buffer clears, interrupt rate.

**This audit’s latencies are code floors.** Runtime p50/p95 against real devices/browsers is Priority-0 instrumentation before claiming ChatGPT parity numbers.

---

## Ranked issue register

Scoring: Impact / Frequency / Difficulty / User pain / Business impact → **1–5** (5 = worst or hardest).

| ID | Issue | Impact | Freq | Diff | Pain | Biz | Priority |
|----|-------|--------|------|------|------|-----|----------|
| P0-1 | No generative LLM on default chat path (templates) | 5 | 5 | 4 | 5 | 5 | **0** |
| P0-2 | TTS waits for complete reply; system speechSynthesis | 5 | 5 | 4 | 5 | 5 | **0** |
| P0-3 | Fake streaming after full compute | 4 | 5 | 2 | 4 | 4 | **0** |
| P0-4 | Half-duplex voice; no listen-while-speak / weak barge-in | 5 | 4 | 5 | 5 | 5 | **0** |
| P0-5 | ChatGPT UX flags default OFF; users hit travel-agent wizard | 5 | 5 | 1 | 4 | 4 | **0** |
| P1-1 | Hands-free 2.5s silence cuts thinking pauses | 4 | 4 | 2 | 4 | 3 | **1** |
| P1-2 | Web Speech `onend` resume clears utterance buffer | 4 | 3 | 2 | 4 | 3 | **1** |
| P1-3 | Follow-up copy is form-like (“سؤال التالي”, no-guessing banner) | 4 | 5 | 2 | 4 | 4 | **1** |
| P1-4 | Itinerary/decision-engine markdown spoken verbatim | 4 | 3 | 2 | 4 | 3 | **1** |
| P1-5 | Memory = slots/`providerMeta`, not dialogue understanding | 4 | 4 | 4 | 4 | 4 | **1** |
| P1-6 | Default push-to-talk vs continuous ChatGPT Voice | 3 | 5 | 1 | 3 | 3 | **1** |
| P1-7 | Browser STT only (no cloud STT / no audio retention) | 4 | 4 | 3 | 4 | 4 | **1** |
| P1-8 | Regex intent / canned Sprint 44 openers | 3 | 5 | 3 | 3 | 3 | **1** |
| P1-9 | Double getUserMedia (VAD + STT) start cost | 2 | 5 | 2 | 2 | 2 | **1** |
| P2-1 | No p50/p95 product metrics for voice→audio | 3 | 5 | 2 | 1 | 3 | **2** |
| P2-2 | VAD energy threshold brittle across devices | 2 | 3 | 2 | 2 | 2 | **2** |
| P2-3 | Sprint 18 realtime stack unused architecture | 2 | 1 | 5 | 1 | 2 | **2** |
| P2-4 | Mid-stream DB persist every 120 chars (noise under load) | 1 | 5 | 1 | 1 | 1 | **2** |
| P2-5 | Home mic never auto-sends (composer only) | 2 | 2 | 1 | 2 | 1 | **2** |

---

## Roadmap

### Priority 0 — Critical blockers (ChatGPT-quality impossible without these)

1. **Ship a real generative reply path** for conversation turns (not itinerary dump formatting as the only voice). Remote LLM adapters exist as stubs — product needs an available model with a conversational system prompt, not another template engine.  
2. **Time-to-first-audio:** stream TTS (or at least sentence-chunk TTS) starting before the full plan exists; never speak the entire markdown report.  
3. **Stop lying with fake streams** as the primary latency story — either stream model tokens or show honest “thinking” without character drip that delays audio.  
4. **Duplex / barge-in voice loop** — listen while speaking; interrupt without killing the whole session metaphor.  
5. **Turn on (or replace) the experience layer that users actually hit** — shipping `ui.chatgpt_experience` OFF while marketing ChatGPT-like UX is a product falsehood; enabling it alone is insufficient without (1).

### Priority 1 — High impact

1. Adaptive endpointing (longer think pauses; don’t clear buffer on STT restart).  
2. Rewrite intake follow-ups into short conversational prose (kill “سؤال التالي” / inventory lists in voice).  
3. Voice-specific reply shaping: 1–3 spoken sentences + optional silent rich card in UI.  
4. Cloud STT (or retain audio) for Arabic robustness.  
5. Conversational memory that recalls free-form commitments, not only slots.  
6. Default continuous/hands-free for a true Voice mode entry point.  
7. Prosody-capable TTS (provider), Arabic-first voice selection.

### Priority 2 — Nice-to-have

1. Instrument p50/p95: mic-start → partial → commit → first delta → first audio → complete.  
2. Device-calibrated VAD.  
3. Retire or hide unused Sprint 18 architecture from the mental model.  
4. Unify home mic and chat voice behaviors.

---

## One-week launch triage

### If I had only one week before launch… what exactly should be fixed first?

**Do not build new engines. Do not flip every flag. Fix the conversational *feel* of the path users already hit.**

#### Day-focus order (technical, not calendar promises)

1. **Voice reply contract (highest ROI in one week)**  
   - Never TTS the full `formatTripPlanReply` / decision-engine dump.  
   - Speak a short conversational summary (2–4 sentences); keep the long plan as on-screen cards/markdown only.  
   - Start TTS as soon as that short spoken string exists (even if UI still streams the rest).  
   *Why first:* This attacks robotic voice + dead-air after long fake streams without a new architecture.

2. **Kill form-wizard spoken intake**  
   - Replace `buildFollowUpQuestion` voice path with one natural question, no “بدون تخمين” banner, no bullet inventory in speech.  
   *Why:* Every incomplete trip becomes a ChatGPT-vs-form comparison the user loses.

3. **Hands-free endpointing + buffer survival**  
   - Raise/adapt silence beyond a blunt 2.5s cut; **do not clear `utteranceBuffer` on STT resume**.  
   *Why:* Stops the “it cuts me off when I think” complaint that ChatGPT Voice does not have.

4. **Honest streaming / status**  
   - If still rule-based: show Thinking → then stream UI without delaying audio; or stream spoken sentence first.  
   - Do not spend the week enabling Sprint 44 canned openers and calling it parity.

5. **Only if credentials already exist:** wire one real LLM for *dialogue* turns (advice/small-talk/follow-ups), keep planners for structured trip objects.  
   - If no keys in a week: skip; (1)–(3) still move perception.

#### Explicitly defer for week one

- New travel modules, new abstractions, Sprint 18 realtime rewrite, full duplex WebRTC, neural TTS vendor bake-off, architecture refactors, enabling the entire flag tree without reply-quality work.

---

## Appendix A — Key files

| Stage | Path |
|-------|------|
| Chat page / default PTT | `src/pages/ChatPage.tsx` |
| Voice session | `src/lib/chat/voice/voiceSession.ts` |
| Silence constants | `src/lib/chat/voice/voiceTypes.ts` |
| VAD | `src/lib/chat/voice/voiceActivityMonitor.ts` |
| STT | `src/lib/chat/voice/webSpeechToTextProvider.ts` |
| TTS | `src/lib/chat/voice/webTextToSpeechProvider.ts` |
| Provider select | `src/lib/chat/chatProviderFactory.ts` |
| Default agent stream | `src/lib/agent/travelAgentProvider.ts` |
| Reply templates | `src/lib/agent/formatReply.ts` |
| LLM stubs | `src/lib/agent/llm/stubLlmAdapters.ts`, `localLlmAdapter.ts` |
| Fake stream (Sprint 32) | `src/lib/chat/conversationExperience/StreamingResponse.ts` |
| Canned “natural” openers | `src/lib/chat/chatgptExperience/naturalLanguage.ts` |
| Flags | `src/lib/ai/featureFlags/featureRegistry.ts` |
| Pipeline logs | `src/lib/chat/pipelineDiagnostics.ts` |

## Appendix B — What this audit did not do

- Did not change product code.  
- Did not run a live ChatGPT Voice A/B on devices (no runtime p95).  
- Did not enable feature flags or wire paid LLM/TTS APIs.  
- Did not refactor.

**Bottom line:** Architecture sprints delivered capacity. Product mode must confront that the default conversation is a **slot-filling travel form with theatrical streaming and delayed browser TTS**. That cannot feel like ChatGPT Voice until replies are generative (or convincingly spoken), audio starts early, and voice is continuous and interruptible.
