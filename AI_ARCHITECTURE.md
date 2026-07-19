# AI Architecture — Phase AB Foundation

## Principles

1. **Additive only** — do not break `TripPlan`, `applyIntelligentDecisions`, booking/payment, or `ProviderAdapter` contracts.
2. **Layered** — agent (planning execution) ≠ ai (enhancement interfaces) ≠ ops (infra metrics).
3. **Privacy first** — personalization/analytics respect settings gates; PII masking via ops helpers.
4. **Deterministic foundations** — Phase AB engines are interface + deterministic helpers (no new LLM provider).
5. **ProviderAdapter preserved** — live search remains Phase W aggregation; AI ranking overlays scored candidates.

## Package map

```
src/lib/ai/
  featureFlags/     FeatureRegistry (product lifecycles)
  preferences/      PreferenceEngine + PersonalizationProfile
  ranking/          RankingEngine
  recommendations/  RecommendationEngine
  planning/         multi-destination, alternatives, confidence, explanations
  analytics/        anonymous ProductAnalytics
  index.ts

src/lib/concierge/          Sprint 9 Conversation Intelligence (above agent)
```

Related (unchanged ownership):

```
src/lib/agent/              TripPlan, decision engine, aggregation, tools
src/lib/agent/aggregation/  ProviderAdapter + Phase W live flags
src/lib/ops/                infra metrics, masking, incidents (Phase AA+)
src/lib/trips/              ManagedTrip / TravelerProfile (PII passengers)
src/lib/settings/           privacy_analytics / privacy_personalization gates
```

## Concierge layer (Sprint 9)

- Sits **above** `travelAgentService` — consultant dialogue, not provider routing.
- **Provider-agnostic:** no Amadeus/Duffel/Travelport/Sabre/Booking/Expedia imports or selection.
- Speaks only to agent abstractions; handoff modes are `plan | search | refine | none`.
- Flag: `ai.concierge`. See `docs/CONCIERGE.md`.

## Flight Results Experience (Sprint 11)

- UI/logic for premium flight cards, sort/filter, details, and select→booking session.
- Package: `src/lib/flightResults` + `src/components/flightResults`.
- Recommendation banner reuses Concierge `buildConsultantReply` (no hardcoded result copy).
- Flag: `ui.flight_results_experience` (depends on `ai.concierge`).
- See `docs/SPRINT11_RESULTS.md` and `docs/LIVE_PROVIDER.md`.

## Passenger Management & Booking Flow (Sprint 12)

- Passenger slots (adult/child/infant) matching itinerary counts, forms, validation, fare summary.
- Package: `src/lib/passengers` + `src/components/passengers` + `/booking/passengers`.
- Concierge party/passport guidance reuses `buildConsultantReply`.
- Persists passengers onto booking session metadata for refresh resume.
- Flag: `ui.passenger_booking_flow` (depends on `ui.flight_results_experience`).
- See `docs/SPRINT12_PASSENGERS.md`.

## My Trips & Booking Records (Sprint 13)

- Booking Record projection over `BookingSession` (single source of truth) with temporary `RHL-*` references.
- My Trips UI: upcoming / completed / cancelled + empty/loading/error states.
- Booking Details: flight, passengers, fare, reference, status, timeline, concierge summary.
- Concierge intents: show trips / latest booking / details / summarize itinerary (agent-layer load + consultant voice).
- Flags: `ui.my_trips` (myTrips), `ui.booking_history` (bookingHistory).
- See `docs/SPRINT13_MY_TRIPS.md`.

## Booking Confirmation Engine (Sprint 14)

- Provider-independent confirmation lifecycle: pending → confirming → confirmed | failed | cancelled.
- Supplier adapter ports (`src/lib/supplierAdapters`) — Amadeus adapter active; Duffel/Travelport/Sabre stubs.
- Confirmation UI + reusable Booking Timeline (ticket-pending ready).
- Concierge: confirmed? / show confirmation / reference / status.
- Flags: `ui.booking_confirmation`, `ui.supplier_adapter`, `ui.booking_timeline`.
- See `docs/SPRINT14_CONFIRMATION_ENGINE.md`.

## Order Management & Payment Preparation (Sprint 15)

- `ManagedOrder` created from confirmed `BookingSession` (Orders reference bookings; session remains SoT).
- Checkout review at `/checkout/order/:orderId` (fare, passengers, conditions, concierge summary).
- Provider-independent payment ports (mock active; Stripe / HyperPay / Moyasar / Tabby / Tamara stubs).
- Payment session lifecycle: create / resume / expire / retry with duplicate-attempt protection.
- Order timeline: Booking Created → Confirmed → Order Created → Awaiting Payment → Paid → Ticket Pending → Completed.
- Concierge: how much / order ready / show checkout / payment status.
- Flags: `ui.order_management`, `ui.checkout_review`, `ui.payment_preparation` (`payments.live` remains off).
- See `docs/SPRINT15_ORDER_MANAGEMENT.md`.

## AI Home Experience (Sprint 16)

- Conversation-first home (`AiHomeExperience`) behind `ui.ai_home`; legacy Home preserved when flag off.
- Hero + personalized greeting + composer; suggested prompts open Chat with seed (Sprint 9 agent).
- Continue booking panel projects unfinished `BookingSession` resume paths.
- Smart travel cards: upcoming trips, recent orders, recommendations, inspiration (placeholders for saved searches / price alerts).
- Home design-system primitives under `src/components/home`.
- Flags: `ui.ai_home`, `ui.conversation_home`, `ui.travel_cards`, `ui.continue_booking`.
- See `docs/SPRINT16_AI_HOME.md`.

## Smart Itinerary AI Engine (Sprint 17)

- Post-booking `TripItinerary` derived from `BookingSession` (+ optional Order pointer); session remains SoT.
- Visual timeline (departure → flight → arrival → hotel/transport placeholders → daily → return).
- Daily planner (morning / afternoon / evening / free time) with LLM-ready placeholders.
- Travel insight cards (airport, duration, timezone, packing, weather, currency, visa) — architecture-ready.
- Concierge: show itinerary / today's plan / leave for airport / summarize trip.
- Route `/itinerary/:sessionId`; flags `ui.smart_itinerary`, `ui.travel_insights`, `ui.daily_planner`.
- See `docs/SPRINT17_SMART_ITINERARY.md`.

## Voice Conversation Foundation (Sprint 18)

- Additive conversational voice architecture (`src/lib/voiceConversation`) — **not** wired into production routes by default.
- State machine: idle → listening → thinking → speaking, plus paused / interrupted / disconnected / error.
- `VoiceProvider` + `VoiceTransport` + `VoiceAudio` abstractions; **MockVoiceProvider** only; OpenAI/Azure/ElevenLabs stubs.
- Interruptible priority queue + conversation timeline (speech, thinking, latency, errors, reconnects).
- Hooks: `useVoiceConversation`, `useVoiceState`, `useVoiceEvents`; UI primitives under `src/components/voice`.
- Flags (default **OFF**): `ui.voice_conversation`, `voice.realtime`, `voice.provider`, `voice.mock`.
- Does **not** connect realtime APIs, accept API keys, generate audio, or invent dialogue.
- Existing Home mic (`useSpeechRecognition`) and Chat STT/TTS remain the production voice input path.
- See `docs/SPRINT18_VOICE_FOUNDATION.md`.

## AI Travel Brain (Sprint 19)

- Additive conversation intelligence layer (`src/lib/brain`) — orchestration only, **no LLM providers**.
- Pipeline: intent → extract entities → update memory → missing slots → travel/response plan.
- Slot-filled `ConversationMemory` (destination, budget, dates, travelers, cabin, airlines, hotels, activities, visa, language, currency).
- Never-ask-twice missing-field detection; structured `BrainResponsePlan` (summary/goal/action/uiHints/search/booking/recs).
- Hooks: `useConversationBrain`, `useConversationMemory`, `useTravelContext`; debug UI under `src/components/brain`.
- Flags (default **OFF**): `brain.enabled`, `brain.memory`, `brain.intent`, `brain.planner`, `brain.debug`.
- Existing agent/concierge (`src/lib/agent`, `src/lib/concierge`) unchanged and remain production SoT until brain is wired.
- See `docs/SPRINT19_AI_BRAIN.md`.

## Concierge Integration (Sprint 20)

- Wires Brain into `travelAgentService.planTurn` so **text and Chat voice** share one reasoning pipeline.
- Every gated user message: Memory → Intent → Context → Planner → `BrainResponsePlan` attached on `AgentProviderMeta.brain`.
- Optional `brain.agent_handoff` merges Brain slots into agent `TripRequirements` before Concierge/agent continue.
- Sprint 18 `voiceConversation` commits run the same Brain turn when `brain.voice` is on (`lastBrainPlan` on session snapshot).
- Flags (default **OFF**): `brain.concierge`, `brain.agent_handoff`, `brain.voice` (all depend on `brain.enabled` / `brain.concierge`).
- When flags are off, Sprint 9–19 behavior is unchanged (full backward compatibility).
- No OpenAI / Azure / ElevenLabs / external APIs.
- See `docs/SPRINT20_CONCIERGE_INTEGRATION.md`.

## Real Travel Conversation Engine (Sprint 21)

- Connects `BrainResponsePlan` to flights, hotels, itineraries, booking sessions, and passenger profiles via structured `TravelPlan` + `TravelDomainBridge` (drafts only — no live provider calls).
- Detects origin, dates, flexible dates, adults/children/infants, cabin, hotel need, budget, preferred airlines/hotels.
- Never re-asks filled memory slots; asks exactly **one** short contextual follow-up when something is missing.
- Text and voice share `runIntegratedBrainTurn` with `brain.travel_engine`.
- Flag (default **OFF**): `brain.travel_engine` (depends on `brain.concierge`).
- See `docs/SPRINT21_TRAVEL_CONVERSATION_ENGINE.md`.

## Multi-Step Trip Planning Engine (Sprint 22)

- `TripPlanningEngine` turns conversation into a durable `PlanningSession` and structured outputs: `TripPlan`, `ClarificationPlan`, `TravelSummary`.
- Stages: Collect → Detect Missing → Clarify (one question) → Update Memory → Produce TripPlan.
- Supports natural corrections (destination swap, dates, travelers, budget, hotel, cheaper flight) without restarting planning.
- Text and voice share `runIntegratedBrainTurn` when `brain.trip_planning` is on.
- Flag (default **OFF**): `brain.trip_planning` (depends on `brain.travel_engine`).
- See `docs/SPRINT22_TRIP_PLANNING_ENGINE.md`.

## Engines (interfaces)

| Engine | Responsibility |
|--------|----------------|
| `PreferenceEngine` | Read/upsert personalization profiles; apply privacy gate |
| `RankingEngine` | Weighted rank of candidates → `rankScore` + confidence + explanation |
| `RecommendationEngine` | Select primary + alternatives with explainable output |

## Planning enhancements

| Capability | API |
|------------|-----|
| Multi-destination | `buildMultiDestinationOutline` |
| Alternative itineraries | `generateAlternativeItineraries` |
| Confidence scoring | `scorePlanningConfidence` |
| Explainable recommendations | `buildExplainableRecommendation` / RecommendationEngine |
| Preference weighting | `applyPreferenceWeighting` + profile `weights` |

These helpers **do not** mutate existing `TripPlan` shape. Future wiring may attach results as optional enrichment (same pattern as `TripPlan.decision?`).

## Analytics

`ProductAnalytics` tracks anonymous session metrics:

- recommendation shown / accepted → acceptance rate
- itinerary started / completed → completion rate
- booking funnel view → hold → payment → ticket → complete

Metadata is masked (`maskMetadata`). Recording is skipped when `analyticsAllowed` is false.

## Compatibility matrix

| Contract | Phase AB impact |
|----------|-----------------|
| `TripPlan` core fields | Unchanged |
| `applyIntelligentDecisions(...)` | Unchanged signature |
| Phase W provider flags | Unchanged; separate from FeatureRegistry |
| `VITE_PAYMENT_PROVIDER=mock` | Preserved; `payments.live` registry flag OFF |
| ProviderAdapter architecture | Preserved |

## Out of scope here

- UI redesign / new customer-facing screens
- Live payment enablement
- Renaming Rahhal / package identity
