/**
 * Phase AB — FeatureRegistry for v1.1 product capabilities.
 * Does not replace Phase W ProviderFeatureFlags.
 */

import type { FeatureDefinition, FeatureId, FeatureLifecycle, FeatureRegistrySnapshot } from './types'

const DEFAULT_FEATURES: FeatureDefinition[] = [
  {
    id: 'ai.multi_destination',
    name: 'Multi-destination trip support',
    description: 'Plan trips spanning multiple cities / hubs.',
    lifecycle: 'beta',
    enabled: true,
  },
  {
    id: 'ai.alternative_itineraries',
    name: 'Alternative itinerary generation',
    description: 'Generate ranked alternative itineraries for the same requirements.',
    lifecycle: 'experimental',
    enabled: true,
    dependsOn: ['ai.recommendation_engine'],
  },
  {
    id: 'ai.confidence_scoring',
    name: 'Confidence scoring',
    description: 'Attach confidence scores to recommendations and plans.',
    lifecycle: 'beta',
    enabled: true,
  },
  {
    id: 'ai.explainable_recommendations',
    name: 'Explainable recommendations',
    description: 'Human-readable whySelected / whyRejected rationales.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.confidence_scoring'],
  },
  {
    id: 'ai.preference_weighting',
    name: 'User preference weighting',
    description: 'Weight ranking by personalization profiles.',
    lifecycle: 'experimental',
    enabled: true,
    dependsOn: ['ai.personalization'],
  },
  {
    id: 'ai.personalization',
    name: 'Personalization foundation',
    description: 'Traveler / hotel / airline / budget / travel-style profiles.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.recommendation_engine',
    name: 'Recommendation engine',
    description: 'Interfaces for RecommendationEngine / PreferenceEngine / RankingEngine.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.analytics',
    name: 'Anonymous usage analytics',
    description: 'Privacy-gated product analytics foundation.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.concierge',
    name: 'AI Concierge conversation intelligence',
    description:
      'Provider-agnostic consultant dialogue above the travel agent. Never selects suppliers.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.travel_reasoning',
    name: 'Autonomous Travel Reasoning Engine',
    description:
      'Sprint 45 open-ended destination discovery, climate/budget/visa reasoning, preference memory bridge, and explainable recommendations on the production agent path.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge', 'ai.recommendation_engine'],
    notes: 'Product alias: travel_reasoning',
  },
  {
    id: 'ai.smart_clarification',
    name: 'Smart Clarification / Never-Ask-Twice',
    description:
      'Sprint 46 — infer soft preferences (interests, weather, hotel, package, budget style, traveler type) so the AI never form-asks them; only hard slots block planning.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: smart_clarification',
  },
  {
    id: 'ai.real_world_intelligence',
    name: 'Real World Intelligence Layer (Sprint 53)',
    description:
      'Sprint 53 — live flight/hotel/weather/visa/event/safety/exchange/transport/price-watch signals via provider abstractions, event bus, cache, and resilience — orchestrated only through RahhalBrain.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.rahhal_brain'],
    notes: 'Product alias: real_world_intelligence',
  },
  {
    id: 'ai.executive_os',
    name: 'Executive Operating System (Sprint 52)',
    description:
      'Sprint 52 — Rahhal Executive OS: global knowledge, decision/multi-objective optimizers, travel graph, prediction, negotiation, goal planning, strategy, explanation v2, and self-review via RahhalBrain.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.executive_platform'],
    notes: 'Product alias: executive_os',
  },
  {
    id: 'ai.executive_platform',
    name: 'Executive Travel Platform (Sprint 51)',
    description:
      'Sprint 51 production executive OS — trip monitor, live concierge, explainable decisions, memory, multimodal documents, budget v2, optimizer, risk, response, and learning engines via RahhalBrain.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.travel_executive', 'ai.rahhal_brain'],
    notes: 'Product alias: executive_platform',
  },
  {
    id: 'ai.travel_executive',
    name: 'AI Travel Executive (Phase 2)',
    description:
      'Phase 2 executive intelligence — context builder, rejected-destination memory, budget warnings, discovery optimizer, and consultant discovery replies via RahhalBrain.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.rahhal_brain', 'ai.persistent_memory'],
    notes: 'Product alias: travel_executive',
  },
  {
    id: 'ai.rahhal_brain',
    name: 'Rahhal Brain Core',
    description:
      'Sprint 50 — central AI orchestration: conversation understanding, multi-intent detection, internal planning, reflection, and response composition on the production agent path.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge', 'ai.travel_reasoning', 'ai.smart_clarification'],
    notes: 'Product alias: rahhal_brain. Orchestrates existing engines; does not replace execution modules.',
  },
  {
    id: 'ai.autonomous_agent',
    name: 'Autonomous Travel Agent',
    description:
      'Sprint 54 — goal-oriented multi-step execution with tool planning, retries, recovery, progress streaming, and observability. Conversation Brain still authors traveler-facing text.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: autonomous_agent. Additive orchestration over existing tools; no hardcoded replies.',
  },
  {
    id: 'ai.booking_intelligence',
    name: 'Real Booking Intelligence',
    description:
      'Sprint 55 — provider registry, result fusion, ranking v2, preference-aware scoring, cost optimization, booking readiness, confidence, and user-facing explanations. Simulated providers until live APIs.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_agent'],
    notes: 'Product alias: booking_intelligence. Post-tool enrichment; Conversation Brain narrates facts only.',
  },
  {
    id: 'ai.live_providers',
    name: 'Live Travel Provider Layer',
    description:
      'Sprint 56 — provider-agnostic live SDK (Amadeus / Duffel / Booking.com) with health, rate limits, cache, selection, secrets, and metrics. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.booking_intelligence'],
    notes:
      'Product alias: live_providers. Structured offers only; Conversation Brain authors traveler-facing text. Requires server secrets — never VITE_* OAuth secrets.',
  },
  {
    id: 'provider.amadeus',
    name: 'Amadeus live adapter',
    description: 'Sprint 56 — Amadeus flight search, airports, offers, and pricing via OAuth.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.live_providers'],
    notes: 'Requires AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET (server-only).',
  },
  {
    id: 'provider.duffel',
    name: 'Duffel live adapter',
    description: 'Sprint 56 — Duffel offer search, details, pricing; order/cancel stubs.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.live_providers'],
    notes: 'Requires DUFFEL_API_TOKEN (server-only).',
  },
  {
    id: 'provider.booking',
    name: 'Booking.com live adapter',
    description:
      'Sprint 60 — Booking.com hotel search with full normalize (address, room, taxes, amenities, geo).',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.live_providers'],
    notes: 'Requires BOOKING_API_KEY or RAPIDAPI_KEY / BOOKING_RAPIDAPI_KEY (server-only preferred).',
  },
  {
    id: 'ai.booking_execution',
    name: 'Booking Execution Engine',
    description:
      'Sprint 57 — booking lifecycle, multi-domain orchestrator, transaction manager, reservations, sessions, unified booking model, notifications, and audit. Default ON.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_intelligence'],
    notes:
      'Product alias: booking_execution. Executes bookings via BookingProvider/Live bridges; Conversation Brain narrates facts only.',
  },
  {
    id: 'ai.transaction_manager',
    name: 'Booking Transaction Manager',
    description:
      'Sprint 57 — retries, rollback, idempotency, timeout handling, and partial failure recovery for booking execution.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_execution'],
    notes: 'Product alias: transaction_manager.',
  },
  {
    id: 'ai.booking_resume',
    name: 'Booking Session Resume',
    description:
      'Sprint 57 — resume interrupted booking sessions with persisted execution state and restart recovery.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_execution'],
    notes: 'Product alias: booking_resume.',
  },
  {
    id: 'ai.payments',
    name: 'Payments Platform',
    description:
      'Sprint 58 — payment orchestrator (card/Apple/Google/Mada/STC/Tabby/Tamara/bank), lifecycle, sessions, fraud, currency engine. Mock adapters only.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_execution'],
    notes:
      'Product alias: payments. Booking Execution requests payment; Conversation Brain narrates facts only. No real gateways.',
  },
  {
    id: 'ai.ticketing',
    name: 'Ticketing Platform',
    description:
      'Sprint 58 — issue unified tickets (flights, hotel/activity vouchers, car, insurance) and document center after successful capture.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.payments'],
    notes: 'Product alias: ticketing.',
  },
  {
    id: 'ai.refunds',
    name: 'Refund Engine',
    description:
      'Sprint 58 — full/partial refunds, provider cancellation tracking, refund timeline, and refund documents.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.payments'],
    notes: 'Product alias: refunds.',
  },
  {
    id: 'ai.persistent_memory',
    name: 'Persistent Preference Memory',
    description:
      'Sprint 48 — durable personalization profiles (localStorage) so budget, weather, traveler, hotel, and favorite destinations survive across chat sessions.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.personalization'],
    notes: 'Product alias: persistent_memory. Taste profiles only — no passport/PII.',
  },
  {
    id: 'ui.flight_results_experience',
    name: 'Flight Results Experience',
    description:
      'Sprint 11 premium flight cards, sort/filter, details, concierge summary, and select→booking session.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge'],
  },
  {
    id: 'ui.passenger_booking_flow',
    name: 'Passenger Management & Booking Flow',
    description:
      'Sprint 12 passenger forms, validation, booking summary, and session persistence before review.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.flight_results_experience'],
  },
  {
    id: 'ui.my_trips',
    name: 'My Trips',
    description:
      'Sprint 13 production My Trips experience (upcoming/completed/cancelled) over booking sessions.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.passenger_booking_flow'],
    notes: 'Product alias: myTrips',
  },
  {
    id: 'ui.booking_history',
    name: 'Booking History',
    description:
      'Sprint 13 booking records, details, timeline, and concierge booking-history intents.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.my_trips'],
    notes: 'Product alias: bookingHistory',
  },
  {
    id: 'ui.booking_confirmation',
    name: 'Booking Confirmation Engine',
    description:
      'Sprint 14 confirmation lifecycle (pending→confirming→confirmed/failed) and confirmation UI.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_history'],
    notes: 'Product alias: booking_confirmation',
  },
  {
    id: 'ui.supplier_adapter',
    name: 'Supplier Adapter Layer',
    description:
      'Sprint 14 provider-independent supplier booking ports (Amadeus active; Duffel/Travelport/Sabre stubs).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: supplier_adapter',
  },
  {
    id: 'ui.booking_timeline',
    name: 'Booking Timeline',
    description:
      'Sprint 14 confirmation timeline UI (created → supplier → ticket pending → completed).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: booking_timeline',
  },
  {
    id: 'ui.booking_flow',
    name: 'Production Booking Flow',
    description:
      'Sprint 25 BookingFlowController orchestration (conversation → review → ready for payment). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.passenger_booking_flow'],
    notes: 'Product alias: booking_flow. Orchestrates existing engines; no new engine.',
  },
  {
    id: 'ui.order_management',
    name: 'Order Management',
    description:
      'Sprint 15 Order entity from confirmed bookings; Orders reference BookingSession (SoT).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: order_management',
  },
  {
    id: 'ui.checkout_review',
    name: 'Checkout Review',
    description:
      'Sprint 15 checkout review page (flight, passengers, fare, conditions, concierge).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.order_management'],
    notes: 'Product alias: checkout_review',
  },
  {
    id: 'ui.payment_preparation',
    name: 'Payment Preparation',
    description:
      'Sprint 15 provider-independent payment ports + payment session lifecycle (mock only).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.order_management'],
    notes: 'Product alias: payment_preparation. Does not enable payments.live.',
  },
  {
    id: 'ui.ai_home',
    name: 'AI Home Experience',
    description:
      'Sprint 16 conversation-first home (hero, composer, suggestions) — replaces legacy OTA-style home when enabled.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: ai_home',
  },
  {
    id: 'ui.conversation_home',
    name: 'Conversation Home Entry',
    description:
      'Sprint 16 routes home composer / prompts into Chat with seed message (Sprint 9 agent).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.ai_home'],
    notes: 'Product alias: conversation_home',
  },
  {
    id: 'ui.travel_cards',
    name: 'Smart Travel Cards',
    description:
      'Sprint 16 home cards: upcoming trips, recent orders, recommendations, inspiration.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.ai_home'],
    notes: 'Product alias: travel_cards',
  },
  {
    id: 'ui.continue_booking',
    name: 'Continue Booking',
    description:
      'Sprint 16 unfinished booking resume panel on AI Home (BookingSession projection).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.ai_home', 'ui.my_trips'],
    notes: 'Product alias: continue_booking',
  },
  {
    id: 'ui.smart_itinerary',
    name: 'Smart Itinerary Engine',
    description:
      'Sprint 17 post-booking TripItinerary from BookingSession (timeline, summary, AI-ready).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: smart_itinerary',
  },
  {
    id: 'ui.travel_insights',
    name: 'Travel Insights',
    description:
      'Sprint 17 architecture-ready insight cards (airport, weather, visa, currency placeholders).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.smart_itinerary'],
    notes: 'Product alias: travel_insights',
  },
  {
    id: 'ui.daily_planner',
    name: 'Daily Planner',
    description:
      'Sprint 17 daily morning/afternoon/evening/free-time plans with LLM-ready placeholders.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.smart_itinerary'],
    notes: 'Product alias: daily_planner',
  },
  {
    id: 'ui.voice_conversation',
    name: 'Voice Conversation UI',
    description:
      'Sprint 18 voice conversation foundation UI (orb/indicators) — architecture only; default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: voice_conversation. Does not enable realtime providers.',
  },
  {
    id: 'voice.realtime',
    name: 'Voice Realtime Transport',
    description:
      'Sprint 18 flag for future realtime transport. Default OFF — no OpenAI/Azure/ElevenLabs I/O.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes: 'Product alias: voice_realtime. Stubs only in Sprint 18.',
  },
  {
    id: 'voice.provider',
    name: 'Voice Provider Selection',
    description:
      'Sprint 18 provider abstraction gate. Default OFF; factory still resolves to mock when exercised.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes: 'Product alias: voice_provider',
  },
  {
    id: 'voice.mock',
    name: 'Mock Voice Provider',
    description:
      'Sprint 18 mock voice provider harness (no audio, no fake dialogue). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes: 'Product alias: voice_mock. Only non-live provider in Sprint 18.',
  },
  {
    id: 'brain.enabled',
    name: 'AI Travel Brain',
    description:
      'Sprint 19 conversation intelligence orchestration layer. Default OFF — no LLM providers.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: brain_enabled',
  },
  {
    id: 'brain.memory',
    name: 'Brain Conversation Memory',
    description: 'Sprint 19 slot-filled conversation memory. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes: 'Product alias: brain_memory',
  },
  {
    id: 'brain.intent',
    name: 'Brain Intent Classifier',
    description: 'Sprint 19 travel intent classification. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes: 'Product alias: brain_intent',
  },
  {
    id: 'brain.planner',
    name: 'Brain Response Planner',
    description: 'Sprint 19 structured response / travel planner. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes: 'Product alias: brain_planner',
  },
  {
    id: 'brain.debug',
    name: 'Brain Debug Panel',
    description: 'Sprint 19 conversation debug UI (memory/intent/planner viewers). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes: 'Product alias: brain_debug',
  },
  {
    id: 'brain.concierge',
    name: 'Brain Concierge Integration',
    description:
      'Sprint 20 wires Brain into travelAgentService.planTurn / Concierge path. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes: 'Product alias: brain_concierge. Text + Chat voice share this pipeline.',
  },
  {
    id: 'brain.agent_handoff',
    name: 'Brain Agent Handoff Merge',
    description:
      'Sprint 20 merges Brain memory slots into agent TripRequirements. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.concierge'],
    notes: 'Product alias: brain_agent_handoff',
  },
  {
    id: 'brain.voice',
    name: 'Brain Voice Session Bridge',
    description:
      'Sprint 20 runs Brain on Sprint 18 voice transcripts (same pipeline as text). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.concierge'],
    notes: 'Product alias: brain_voice',
  },
  {
    id: 'brain.travel_engine',
    name: 'Real Travel Conversation Engine',
    description:
      'Sprint 21 connects BrainResponsePlan to flights/hotels/itineraries/booking/passengers with contextual one-question follow-ups. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.concierge'],
    notes: 'Product alias: brain_travel_engine. No external LLM providers.',
  },
  {
    id: 'brain.trip_planning',
    name: 'Multi-Step Trip Planning Engine',
    description:
      'Sprint 22 TripPlanningEngine with PlanningSession stages, corrections, TripPlan / ClarificationPlan / TravelSummary. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.travel_engine'],
    notes: 'Product alias: brain_trip_planning. No external AI providers.',
  },
  {
    id: 'brain.execution',
    name: 'Travel Execution Engine',
    description:
      'Sprint 23 converts TripPlan into executable search tasks via mock provider adapters. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.trip_planning'],
    notes: 'Product alias: brain_execution. No Amadeus/OpenAI/Azure/ElevenLabs/Maps/Booking.com.',
  },
  {
    id: 'brain.search',
    name: 'Search Aggregation Engine',
    description:
      'Sprint 24 aggregates mock provider results into normalized, ranked recommendations. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.execution'],
    notes: 'Product alias: brain_search. No live Amadeus/Booking/Maps/Google APIs.',
  },
  {
    id: 'brain.real_providers',
    name: 'Real Provider Adapters',
    description:
      'Sprint 26 wires real/mixed execution providers (Amadeus/Booking wrappers) behind the same interfaces. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.execution'],
    notes:
      'Product alias: brain_real_providers. Phase W VITE_LIVE_PROVIDERS_ENABLED remains the live-HTTP kill switch; mocks always available as fallback.',
  },
  {
    id: 'brain.trip_orchestrator',
    name: 'AI Trip Orchestrator',
    description:
      'Sprint 27 central AITripOrchestrator coordinating conversation, search aggregation, booking flow, and providers. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.search'],
    notes:
      'Product alias: brain_trip_orchestrator. Orchestration only — no new planning/search/booking engine. Optional booking via ui.booking_flow; real providers via brain.real_providers.',
  },
  {
    id: 'brain.context_memory',
    name: 'Conversation Memory & Context Engine',
    description:
      'Sprint 28 short-term conversation memory, long-term travel preferences, context assembly, summarization, and privacy-safe retention. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.trip_orchestrator'],
    notes:
      'Product alias: brain_context_memory. Additive to Sprint 19–27; passport/nationality only when explicitly provided; no LLM providers.',
  },
  {
    id: 'brain.unified_travel_planner',
    name: 'Unified Travel Planning Engine',
    description:
      'Sprint 31 end-to-end UnifiedTravelPlanner combining orchestrator, memory, flight/hotel foundations, and search aggregation into ranked itineraries. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.trip_orchestrator'],
    notes:
      'Product alias: unified_travel_planner. Additive coordinator — does not replace TripPlanningEngine, AITripOrchestrator, or SearchAggregationEngine.',
  },
  {
    id: 'brain.conversation_ui',
    name: 'AI Conversation Experience',
    description:
      'Sprint 32 production conversational UI layer over UnifiedTravelPlanner and AITripOrchestrator. Natural planning without booking forms. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.unified_travel_planner'],
    notes:
      'Product alias: conversation_ui. Additive chat experience — reuses planner/orchestrator/memory; does not duplicate planning or booking logic.',
  },
  {
    id: 'brain.travel_execution_engine',
    name: 'Travel Execution Engine',
    description:
      'Sprint 33 booking Travel Execution Engine — converts a selected UnifiedTravelPlanOption into sandbox flight/hotel reservations via provider ports. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.conversation_ui'],
    notes:
      'Product alias: travel_execution_engine. Distinct from Sprint 23 brain.execution (search tasks). Orchestrates providers without embedding supplier logic.',
  },
  {
    id: 'brain.payments_platform',
    name: 'Payments & Checkout Platform',
    description:
      'Sprint 34 payments platform — payment intents, multi-provider sandbox adapters, receipts/invoices, refunds, and conversation pay-now after TravelExecutionEngine. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.travel_execution_engine'],
    notes:
      'Product alias: payments_platform. Additive to src/lib/payment hosted checkout; does not duplicate planning/execution/booking logic. Sandbox adapters only — no live Stripe/Adyen credentials.',
  },
  {
    id: 'brain.trip_management',
    name: 'Post Booking & Trip Management',
    description:
      'Sprint 35 post-booking My Trip experience — itinerary/documents, notifications, flight status, cancellation/refund tracking after payments platform. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.payments_platform'],
    notes:
      'Product alias: trip_management. Extends existing src/lib/trips TripManager/TripRepository; does not duplicate payment/execution/planner logic.',
  },
  {
    id: 'brain.refund_policy_engine',
    name: 'Universal Cancellation & Refund Policy Engine',
    description:
      'Sprint 36 policy engine — normalize provider cancellation rules, quote/execute refunds across flights/hotels/cars/activities with partial cancel, audit, and conversation explanations. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.trip_management'],
    notes:
      'Product alias: refund_policy_engine. Reuses PaymentOrchestrator.refund and PostBookingService; adapters normalize provider policies without embedding supplier SDKs.',
  },
  {
    id: 'brain.travel_disruption_engine',
    name: 'Travel Disruption & Smart Recovery Engine',
    description:
      'Sprint 37 disruption detection and smart recovery — severity/impact, alternative search, ranked recovery plans, automatic trip updates, and conversation-triggered handling. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.refund_policy_engine'],
    notes:
      'Product alias: travel_disruption_engine. Extends PostBookingService / NotificationScheduler; does not rewrite planner, payments, or refund policy calculation.',
  },
  {
    id: 'brain.loyalty_platform',
    name: 'Universal Loyalty, Rewards & Membership Platform',
    description:
      'Sprint 38 loyalty platform — Rahhal Points wallet, membership tiers/benefits, airline & hotel loyalty adapters, and smart rewards recommendations across travel services. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.travel_disruption_engine'],
    notes:
      'Product alias: loyalty_platform. Additive rewards layer; does not rewrite planner, payments, refunds, or disruption recovery.',
  },
  {
    id: 'brain.travel_documents',
    name: 'Universal Travel Documents & Visa Intelligence Platform',
    description:
      'Sprint 39 travel-document intelligence — destination rules, passport/visa/vaccination checks, alerts, and conversation explanations across travel services. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.loyalty_platform'],
    notes:
      'Product alias: travel_documents. Sandbox destination rules with future government-integration hooks; does not rewrite booking/payments stacks.',
  },
  {
    id: 'brain.supplier_marketplace',
    name: 'Universal Supplier Marketplace & Contract Platform',
    description:
      'Sprint 40 B2B supplier marketplace — onboarding/KYC, contracts, inventory, performance scoring, AI ranking, and supplier dashboard analytics. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.travel_documents'],
    notes:
      'Product alias: supplier_marketplace. Additive supplier layer; does not replace existing provider adapters or booking execution.',
  },
  {
    id: 'brain.finance_platform',
    name: 'Universal Revenue, Finance & Settlement Platform',
    description:
      'Sprint 41 post-booking finance backbone — revenue recognition, wallets, settlements, double-entry ledger, invoices, tax/FX, and financial reports. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.supplier_marketplace'],
    notes:
      'Product alias: finance_platform. Not a payment gateway; additive finance layer after booking/payments.',
  },
  {
    id: 'providers.hotel_foundation',
    name: 'Hotel Provider Foundation',
    description:
      'Sprint 30 generic HotelProvider registry with Hotelbeds / Expedia Rapid / Booking Connectivity sandbox adapters, cache, failover, and brain bridges. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.execution'],
    notes:
      'Product alias: hotel_provider_foundation. Sandbox/mock only — no production credentials. Integrates with AITripOrchestrator, conversation memory, and Search Aggregation.',
  },
  {
    id: 'payments.live',
    name: 'Live payment providers',
    description: 'Enable live payment rails (Moyasar etc.). Remains OFF in v1.1 planning.',
    lifecycle: 'deprecated',
    enabled: false,
    notes: 'Keep VITE_PAYMENT_PROVIDER=mock until payment production freeze lifts.',
  },
  {
    id: 'providers.live_master',
    name: 'Live travel providers master switch',
    description: 'Master flag for Amadeus / Booking / Maps / Weather live calls.',
    lifecycle: 'stable',
    enabled: false,
    notes: 'Defaults OFF; Phase W provider flags still authoritative at runtime.',
  },
  {
    id: 'ui.conversation_experience',
    name: 'Conversation Experience & Booking UX',
    description:
      'Sprint 42 production conversation UX — rich travel cards, in-chat booking actions, timeline, live notifications, maps, memory chips, themes. Presentation only over Sprint 32–35 engines. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.conversation_ui'],
    notes:
      'Product alias: conversation_experience. Does not create new backend engines; integrates conversation UI, execution, payments, trips, and memory.',
  },
  {
    id: 'brain.ai_orchestrator',
    name: 'Rahhal AI Orchestrator',
    description:
      'Sprint 43 central AI tool routing, planning, parallel execution, ranking, and conversational synthesis. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: [
      'brain.conversation_ui',
      'brain.finance_platform',
    ],
    notes:
      'Product alias: ai_orchestrator. Routes to existing engines only — no duplicated business logic.',
  },
  {
    id: 'ui.chatgpt_experience',
    name: 'ChatGPT-like Conversation Experience',
    description:
      'Sprint 44 ChatGPT-quality conversation layer — memory manager, intent, response planner, tool decision, streaming UX, voice states, context recovery. Orchestrates existing engines only. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.conversation_experience'],
    notes:
      'Product alias: chatgpt_experience. No new travel engines; focuses on natural, interruptible, contextual chat/voice UX.',
  },
]

export class FeatureRegistry {
  private readonly byId = new Map<FeatureId, FeatureDefinition>()

  constructor(definitions: FeatureDefinition[] = DEFAULT_FEATURES) {
    for (const def of definitions) {
      this.byId.set(def.id, { ...def, dependsOn: def.dependsOn ? [...def.dependsOn] : undefined })
    }
  }

  list(): FeatureDefinition[] {
    return [...this.byId.values()].map((d) => ({ ...d, dependsOn: d.dependsOn ? [...d.dependsOn] : undefined }))
  }

  get(id: FeatureId): FeatureDefinition | null {
    const row = this.byId.get(id)
    return row ? { ...row, dependsOn: row.dependsOn ? [...row.dependsOn] : undefined } : null
  }

  isEnabled(id: FeatureId): boolean {
    const feature = this.byId.get(id)
    if (!feature || !feature.enabled) return false
    for (const dep of feature.dependsOn ?? []) {
      if (!this.isEnabled(dep)) return false
    }
    return true
  }

  setEnabled(id: FeatureId, enabled: boolean): FeatureDefinition {
    const current = this.byId.get(id)
    if (!current) throw new Error(`Unknown feature: ${id}`)
    const next = { ...current, enabled }
    this.byId.set(id, next)
    return { ...next }
  }

  setLifecycle(id: FeatureId, lifecycle: FeatureLifecycle): FeatureDefinition {
    const current = this.byId.get(id)
    if (!current) throw new Error(`Unknown feature: ${id}`)
    const next = { ...current, lifecycle }
    this.byId.set(id, next)
    return { ...next }
  }

  listByLifecycle(lifecycle: FeatureLifecycle): FeatureDefinition[] {
    return this.list().filter((f) => f.lifecycle === lifecycle)
  }

  snapshot(): FeatureRegistrySnapshot {
    const features = this.list()
    return {
      features,
      enabledIds: features.filter((f) => this.isEnabled(f.id)).map((f) => f.id),
    }
  }
}

let defaultRegistry: FeatureRegistry | null = null

export function getFeatureRegistry(): FeatureRegistry {
  if (!defaultRegistry) defaultRegistry = new FeatureRegistry()
  return defaultRegistry
}

export function resetFeatureRegistry(): void {
  defaultRegistry = null
}

export function createDefaultFeatureRegistry(): FeatureRegistry {
  return new FeatureRegistry()
}
