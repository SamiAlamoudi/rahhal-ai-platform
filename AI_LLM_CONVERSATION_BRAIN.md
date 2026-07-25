# AI LLM Conversation Brain — Phase 5

**Status:** Additive library · Feature flag **OFF** · Draft PR only · No UI redesign · Production remote APIs **disabled**  
**Continues from:** Phase 4 Conversation Intelligence (#258)  
**Spine:** `chatEngine` → `travelAgentService.planTurn` (unchanged ownership)

Flag: `ai.llm_conversation_brain` (default **OFF**)

## Goal

Rahhal thinks before replying — senior travel consultant reasoning.  
**Primary:** LLM-style mock reasoner (no network / no production keys).  
**Fallback:** Phase 4 rule/regex Conversation Intelligence.

## Architecture

```text
User utterance
      |
      v
ConversationState (dialect, locale, corrections)
      |
      v
ContextOptimizer (dedupe + compress travel facts)
      |
      v
PromptBuilder (consultant system + compact user prompt)
      |
      v
Mock LLM Reasoner  ----fail---->  Phase 4 rules fallback
  (intent + entities)
      |
      v
TravelReasoner (season, visa, style, risks)
      |
      v
ToolDecisionEngine (flights/hotels/visa/weather/...)
      |
      v
ConfidenceEvaluator (high | medium | low)
      |
      v
ResponseComposer (warm, dialect-aware, never invent bookings)
      |
      v
planTurn soft enrich (flag ON) -> meta.llmBrain (+ debug stages)
```

Package: `src/lib/agent/llmBrain/`

| Module | Role |
|--------|------|
| `LLMConversationBrain` | Orchestrator pipeline |
| `ConversationPlanner` | Stage plan / trace updates |
| `TravelReasoner` | Destination / season / risk reasoning |
| `ToolDecisionEngine` | Tool routing (not interview scripts) |
| `ResponseComposer` | Natural consultant replies |
| `ConfidenceEvaluator` | high / medium / low + clarify |
| `ContextOptimizer` | Prompt window compression |
| `ConversationState` | Dialect + turn state |
| `PromptBuilder` | System + user prompts |
| `MockLlmReasoner` | LLM-first path (APIs off) |

## LLM pipeline (reasoning)

1. Memory / state  
2. Context build (compressed facts)  
3. Intent (LLM-mock → rules fallback)  
4. Entities (dialect-aware)  
5. Travel reasoning  
6. Need tool? → ToolDecisionEngine  
7. Compose answer  
8. Confidence / clarify if low  

Streaming-ready: `runLlmConversationBrain` is sync/pure today and safe on partial text; voice can call per partial.

## Prompt strategy

- System prompt encodes Rahhal personality + safety (no invented bookings/prices/visa approvals).  
- User prompt carries: locale, dialect, turn, compressed facts, corrections, recent compressed lines, latest utterance.  
- ContextOptimizer removes duplicate recent lines and keeps only important travel facts.

## Tool routing

Tools are chosen from intent + memory + reasoning confidence:

`search_flights` · `search_hotels` · `ask_question` · `continue_conversation` · `need_weather` · `need_visa` · `need_map` · `need_currency` · `need_itinerary` · `none`

Inspiration (“somewhere cold”) → continue conversation + recommend, **not** immediate search.

## Confidence strategy

| Level | Behavior |
|-------|----------|
| high | Proceed / suggest next tool |
| medium | Recommend with light caution |
| low | Ask one outcome-changing clarification |

## Observability

`meta.llmBrain.debugStages` carries reasoning stages for a future debug panel.  
**Hidden in production UI** (no panel wired; flag OFF).

## Conversation examples

**Saudi dialect**

> أبي اليابان. خلها أكتوبر. ميزانيتي عشرة.  
> → Japan · October · 10000 SAR · mock LLM · proactive autumn / visa / JR Pass notes

**Cold inspiration**

> I want somewhere cold.  
> → Reasons season + budget + visa soft factors → suggests Georgia / Switzerland / Hokkaido

**Mixed**

> مو مشكلة لو ترانزيت. Business class. Hotel قريب من المترو.  
> → flexible stops · business cabin · near-metro hotel

## Safety

- Never invent bookings, prices, or visa approvals.  
- Composer always distinguishes tool-backed facts vs estimates.  
- Remote OpenAI/Anthropic/Gemini paths are **not** called by this package.

## Integration rules

- Flag **OFF** → zero behavior change.  
- When ON: soft-merge requirements + attach `meta.llmBrain`.  
- Does not replace `runConversationBrain` reply authorship, booking, or search engines.  
- Draft only — do not merge.

## Test report

Suite: `src/lib/__tests__/llmBrain.phase5.test.ts`  
Validate: `npm run lint`, `npm run typecheck`, `npm run arch:circular`, `npm run test:run`.
