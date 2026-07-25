# AI Conversation Intelligence — Phase 4

**Status:** Additive library · Feature flag **OFF** · Draft PR only · No UI redesign · No booking/search engine changes  
**Spine:** `chatEngine` → `travelAgentService.planTurn` (unchanged ownership)

Flag: `ai.conversation_intelligence` (default **OFF**)

## Goal

Turn Rahhal from interview-mode chatbot into a **travel consultant** that extracts context, remembers the trip, asks sparingly, and suggests proactively.

## Conversation flow

```text
User utterance (partial or complete)
        |
        v
+-------------------+
| IntentDetector    |  flights / hotels / visa / weather / ...
+---------+---------+
          v
+-------------------+
| EntityExtractor   |  destination, dates, travelers, budget, prefs
+---------+---------+
          v
+-------------------+
| ReferenceResolver |  there / same hotel / next week / that airline
+---------+---------+
          v
+-------------------+
| ConversationMemory|  continuous LiveTravelMemory merge
+---------+---------+
          v
+-------------------+     +------------------+
| Conversation      |---->| QuestionPlanner  |  <=2 outcome questions
| Summarizer        |     +------------------+
+---------+---------+
          v
+-------------------+
| TravelConsultant  |  proactive tips + warm notes
+---------+---------+
          v
planTurn soft enrich (flag ON only) -> AgentProviderMeta.conversationIntelligence
```

## Streaming thinking

`analyzeConversation({ streaming: true })` is safe on **partial** transcripts. While the user is still speaking / typing, the same pipeline can run:

1. Intent detection
2. Entity extraction
3. Planning cues (questions / summary readiness)
4. Memory update
5. Context building (consultant notes)

No wait-until-finished requirement at the library layer. Voice UX can call this as STT partials arrive.

## Memory architecture

```text
LiveTravelMemory
├── destination / cities
├── budgetAmount / currency
├── startDate / endDate / monthHint / flexibleDates
├── travelers { adults, children, infants, total }
├── purpose (business | leisure | family | honeymoon | adventure | luxury)
├── hotelPreferences[] / flightPreferences[]
├── airlines[] / seatPreference / stopoverPreference
├── activities[]
├── visaStatus / passportNationality
├── weatherPreference / languagePreference
└── specialRequests[]
```

`ConversationMemory` store: `applyEntities` -> `updateLiveTravelMemory` (merge, never wipe).

## Intent architecture

| Intent | Examples |
|--------|----------|
| `search_flights` | flights, تذكرة |
| `search_hotels` | hotel, فندق |
| `complete_trip` | plan a trip, أريد السفر |
| `visa_question` | visa, تأشيرة |
| `weather` | weather, طقس |
| `budget_advice` | is it enough, كم أحتاج |
| `modify_trip` / `cancel_booking` | change / cancel |
| `travel_inspiration` | surprise me, أين أذهب |
| `packing` / `travel_rules` / `airport_info` | pack, customs, terminal |
| `local_transport` / `restaurants` | JR Pass, مطعم |
| `emergency` / `currency` | lost passport, exchange |

Primary intent = highest-confidence rule match; trip cues fall back to `complete_trip`.

## Entity extraction examples

| Utterance | Extracted |
|-----------|-----------|
| `I want Tokyo in October with my wife around ten thousand.` | Tokyo · October · 2 adults · 10000 SAR |
| `أبغى Tokyo في أكتوبر مع زوجتي حوالي 10000 ريال` | same |
| `رحلة عائلية إلى دبي في مارس` | Dubai · March · family |

## Conversation examples

**No interview mode**

> User: I want Tokyo in October with my wife around ten thousand. Quiet hotels.  
> Rahhal (summary):  
> مما فهمتُ حتى الآن:  
> • Tokyo  
> • October  
> • 2 بالغ  
> • حوالي 10,000 SAR  
> • quiet  
> هل فهمت طلبك بشكل صحيح؟

**Intelligent question (outcome-changing)**

> أتفضّل رحلات مباشرة، أم لا مانع من توقف واحد إن وفّر مبلغاً جيداً؟

**Proactive**

> أكتوبر في طوكيو رائع… أزهار الكرز غير متاحة حينها.  
> قد تحتاج تأشيرة…  
> JR Pass قد يوفّر…

## Modules

Package: `src/lib/agent/conversationIntelligence/`

| Module | Role |
|--------|------|
| `ConversationMemory` | Live travel memory store |
| `EntityExtractor` | AR / EN / mixed extraction |
| `IntentDetector` | Intent classification |
| `ReferenceResolver` | Anaphora / "same X" |
| `ConversationSummarizer` | Confirmation bullets |
| `QuestionPlanner` | <=2 outcome questions; filter interview slots |
| `TravelConsultant` | Personality + proactive tips |
| `analyze` / `enrich` | Pipeline + planTurn soft enrich |

## Integration rules

- Flag **OFF** -> zero behavior change.
- When ON (tests / explicit option): soft-merge into `AgentMemory.requirements`, attach `meta.conversationIntelligence`, filter classic interview `missingFields`.
- Does **not** replace `extractFromUserText`, `chatEngine`, booking, or search engines.
- No production API keys. No merge without review.

## Test report

Suite: `src/lib/__tests__/conversationIntelligence.phase4.test.ts`  
Validate with: `npm run lint`, `npm run typecheck`, `npm run arch:circular`, `npm run test:run`.
