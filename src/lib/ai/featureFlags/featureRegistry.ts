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
    id: 'ai.consultant_reasoning',
    name: 'Consultant Reasoning Layer (Evolution Sprint 1)',
    description:
      'Additive offline consultant reasoning (intent, profile, constraints, destination/budget/risk/value, recommendation, explanation). Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes: 'Product alias: consultant_reasoning. Default OFF until a later wiring sprint.',
  },
  {
    id: 'ai.consultant_reflection',
    name: 'Consultant Reflection Layer (Evolution Sprint 2)',
    description:
      'Additive offline reflection: conversation memory, confidence evolution, incremental node refresh, recommendation revision. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_reasoning'],
    notes: 'Product alias: consultant_reflection. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.planning_graph',
    name: 'Planning Graph Layer (Evolution Sprint 4)',
    description:
      'Additive offline multi-plan DAG: branch, merge, compare, reject, restore, clone, score. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_reflection'],
    notes: 'Product alias: planning_graph. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.traveler_intelligence',
    name: 'Traveler Intelligence Layer (Evolution Sprint 5)',
    description:
      'Additive offline evolving behavioral traveler model (preferences, DNA, biases). Not a CRM profile. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_reasoning'],
    notes: 'Product alias: traveler_intelligence. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.recommendation_intelligence',
    name: 'Recommendation Intelligence Layer (Evolution Sprint 6)',
    description:
      'Additive offline expert consultant recommendations: explain, compare, justify, challenge assumptions. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.planning_graph'],
    notes: 'Product alias: recommendation_intelligence. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.destination_intelligence',
    name: 'Destination Intelligence Layer (Evolution Sprint 7)',
    description:
      'Additive offline consultant-grade destination knowledge, seasonality, traveler matching, and comparisons. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_reasoning'],
    notes: 'Product alias: destination_intelligence. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.travel_strategy',
    name: 'Travel Strategy Intelligence Layer (Evolution Sprint 8)',
    description:
      'Additive offline travel strategy optimization (timing, budget, comfort, route). Does not choose destinations. Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.destination_intelligence'],
    notes: 'Product alias: travel_strategy. Default OFF. Zero production impact until wired.',
  },
  {
    id: 'ai.consultant_pipeline',
    name: 'Consultant Pipeline Orchestration (AI Integration Stage 1)',
    description:
      'Additive offline orchestration of existing consultant intelligence layers into one pipeline. Enrich-only context; not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.travel_strategy'],
    notes: 'Product alias: consultant_pipeline. Default OFF. Stage 2 may attach read-only enrichment after planTurn when enabled; never mutates planning.',
  },
  {
    id: 'ai.consultant_response',
    name: 'Unified Consultant Response (AI Integration Stage 3)',
    description:
      'Additive offline aggregation of consultant pipeline stage outputs into one multi-format consultant response. Read-only; never mutates production planning.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_pipeline'],
    notes: 'Product alias: consultant_response. Default OFF. Formats: executive / short / detailed / consultant.',
  },
  {
    id: 'ai.runtime_coordinator',
    name: 'AI Runtime Coordinator (AI Integration Stage 4)',
    description:
      'Additive offline runtime coordinator for consultant intelligence: ordering, deps, cache, timeout, retry, error isolation. Read-only; never mutates production planning.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.consultant_response'],
    notes: 'Product alias: runtime_coordinator. Default OFF. Coordinates execution only.',
  },
  {
    id: 'ai.conversation_orchestrator',
    name: 'Conversation Orchestrator (AI Evolution Phase 3 Stage 1)',
    description:
      'Additive conversation management layer above the Runtime Coordinator: intent detection, memory, stage planning, and conversational reply. Never plans trips or scores destinations.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.runtime_coordinator'],
    notes: 'Product alias: conversation_orchestrator. Default OFF. Coordinates conversation only.',
  },
  {
    id: 'ai.multi_turn_conversation',
    name: 'Multi-Turn Conversation Manager (AI Evolution Phase 3 Stage 2)',
    description:
      'Additive persistent multi-turn dialogue continuity: session memory, topic detection, clarification discipline, summarization, and recovery. Never plans trips or scores destinations.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.conversation_orchestrator'],
    notes: 'Product alias: multi_turn_conversation. Default OFF. Conversation continuity only.',
  },
  {
    id: 'ai.proactive_advisor',
    name: 'Proactive Travel Advisor (AI Evolution Phase 3 Stage 3)',
    description:
      'Additive proactive opportunity recommendations (visa, weather, family, business, budget tips). Metadata-only; never mutates planning, itineraries, pricing, or conversation text.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.multi_turn_conversation'],
    notes: 'Product alias: proactive_advisor. Default OFF. Recommendations only via meta.proactiveAdvisor.',
  },
  {
    id: 'ai.travel_intelligence',
    name: 'Travel Intelligence Layer (AI Evolution Phase 3 Stage 4)',
    description:
      'Additive isolated intelligence layer: compare alternatives, trade-offs, confidence, ranking, and justifications. Metadata-only (meta.travelIntelligence). Not wired into planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.proactive_advisor'],
    notes: 'Product alias: travel_intelligence. Default OFF. Evaluation only; never mutates planning.',
  },
  {
    id: 'ai.experience_layer',
    name: 'Experience Intelligence Layer (AI Evolution Phase 3 Stage 5)',
    description:
      'Additive isolated UI-ready experience composition from existing AI outputs. Metadata-only (meta.experience). Not wired into planTurn. No external APIs.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.travel_intelligence'],
    notes: 'Product alias: experience_layer. Default OFF. Presentation models only; never mutates planning.',
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
    id: 'ai.budget_intelligence',
    name: 'Budget Intelligence',
    description:
      'Sprint 75 — conversation budget extraction, currency/range detection, category allocation, Budget Score ranking across flights/hotels/packages, and diagnostics. Additive post-tool enrichment.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_agent'],
    notes:
      'Product alias: budget_intelligence. Does not replace search engines; Conversation Brain narrates facts only.',
  },
  {
    id: 'ai.traveler_personalization',
    name: 'Traveler Personalization Intelligence',
    description:
      'Sprint 76 — conversation preference learning (airlines, hotels, cabin, seat, trip style), gradual confidence, preference-weighted ranking, mock profile storage, and diagnostics. Additive enrichment.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_agent'],
    notes:
      'Product alias: traveler_personalization. Mock storage only; no DB. Does not redesign RahhalBrain or search engines.',
  },
  {
    id: 'ai.trip_optimizer',
    name: 'Complete Trip Optimizer',
    description:
      'Sprint 77 — Journey Score optimization across flight+hotel packages (comfort, convenience, travel time, family, business, luxury, budget) with recommendation labels and tradeoff diagnostics. Additive enrichment.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_agent'],
    notes:
      'Product alias: trip_optimizer. Does not replace search engines or Budget/Personalization layers; Conversation Brain narrates facts only.',
  },
  {
    id: 'ai.travel_planner',
    name: 'AI Travel Strategy Planner',
    description:
      'Sprint 78 — pre-search travel strategy: purpose, constraints, missing info, combined clarifying questions, search order, priority weights, and risk flags. Additive reasoning before engines.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_agent'],
    notes:
      'Product alias: travel_planner. Runs before Flight/Hotel search; does not redesign RahhalBrain or replace engines.',
  },
  {
    id: 'ai.autonomous_decision',
    name: 'Autonomous Search & Decision Engine',
    description:
      'Sprint 79 — multi-plan search generation, parallel plan execution, candidate scoring/ranking, explainable recommendation bundle (best overall/budget/fastest/comfort/family). Additive post-search decision layer.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.travel_planner'],
    notes:
      'Product alias: autonomous_decision. Core modules under src/core; does not replace Flight/Hotel engines or RahhalBrain.',
  },
  {
    id: 'ai.adaptive_learning',
    name: 'Adaptive Learning & Personalization Engine',
    description:
      'Sprint 80 — online preference adaptation from conversation, feedback, and booking behavior; confidence ladder; Decision Engine ranking adjustments; local-only profile with reset/disable. Not ML training.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.autonomous_decision'],
    notes:
      'Product alias: adaptive_learning. Local PreferenceStore only; no external training or data leakage. Additive to Decision Engine.',
  },
  {
    id: 'ai.price_intelligence',
    name: 'AI Price Intelligence & Booking Timing',
    description:
      'Sprint 81 — booking timing reasoning (BOOK_NOW / WAIT / WATCH_PRICE / …) from offer pools, historical observations, demand, seasonality, and availability. Not a live pricing feed.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.adaptive_learning'],
    notes:
      'Product alias: price_intelligence. Additive post-decision layer; RahhalBrain unchanged.',
  },
  {
    id: 'ai.dynamic_packages',
    name: 'AI Dynamic Travel Packages',
    description:
      'Sprint 83 — build, score, rank, and explain complete travel packages (flight/hotel/transfer/activities/addons) with compatibility filtering. Feeds Decision Engine via prioritized offer pools without contract changes.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.price_intelligence'],
    notes:
      'Product alias: dynamic_packages. Additive Package Builder layer; RahhalBrain and Decision Engine public APIs unchanged.',
  },
  {
    id: 'ai.itinerary_refinement',
    name: 'Autonomous Itinerary Refinement Engine',
    description:
      'Sprint 84 — incremental package refinement from conversation changes (constraints, schedule, conflicts, alternatives) between Package Builder and Decision Engine. No full rebuild.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.dynamic_packages'],
    notes:
      'Product alias: itinerary_refinement. Feeds Adaptive Learning outcomes; Decision Engine consumes refined offer pools only.',
  },
  {
    id: 'ai.unified_trip',
    name: 'Unified Travel Intelligence',
    description:
      'Sprint 93 — compose one presentation-ready Trip object from existing engines and providers (flights, hotels, activities, transfers, visa, insurance placeholders, pricing, timeline, alternatives, confidence).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.dynamic_packages', 'ai.itinerary_refinement'],
    notes:
      'Product alias: unified_trip. Additive TripComposer under src/core/trip. Does not redesign engines.',
  },
  {
    id: 'ai.constitution',
    name: 'Rahhal AI Constitution',
    description:
      'Sprint 87 — governing behavioral principles for all AI components (never end with no results, mission before destination, explainability, alternatives, recovery, intent respect). Governance validators only; no engine redesign.',
    lifecycle: 'stable',
    enabled: true,
    notes:
      'Product alias: constitution. Additive policy/validator layer under src/core/constitution. Does not change engine public APIs.',
  },
  {
    id: 'ai.alpha_experience',
    name: 'Production Alpha Experience',
    description:
      'Sprint 91 — ConversationOrchestrator connecting intent, constitution, search, packages, refinement, decision, explanations, alternatives, and timeline into one Alpha conversation flow. Presentation/orchestration only.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.itinerary_refinement', 'ai.constitution', 'ai.dynamic_packages'],
    notes:
      'Product alias: alpha_experience. Additive experience layer under src/core/alphaExperience. Does not redesign engines.',
  },
  {
    id: 'ai.concierge_experience',
    name: 'AI Concierge Experience',
    description:
      'Sprint 96 presentation + Sprint 111 decision conversation layer after Response Composer (explanations, tradeoffs, scenarios, savings, narration, metadata). Presentation only — does not modify Decision Engine.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.alpha_experience', 'ai.unified_trip'],
    notes:
      'Product alias: concierge_experience. Sprint 96: src/core/conciergeExperience. Sprint 111 additive: src/lib/agent/concierge (post–Response Composer). Distinct from legacy ai.concierge. Does not redesign engines. Sprint 111 runner is inert until called.',
  },
  {
    id: 'ai.booking_assistant',
    name: 'Smart Booking Assistant',
    description:
      'Sprint 101 — guides traveler from planning to booking readiness: checklist, timeline, warnings, next actions, and summary composed from existing Alpha / engine outputs. Presentation/orchestration only.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.alpha_experience'],
    notes:
      'Product alias: booking_assistant. Additive under src/core/bookingAssistant. Does not modify booking engines, providers, or search.',
  },
  {
    id: 'ai.booking_execution_confirmation',
    name: 'Booking Execution & Confirmation',
    description:
      'Sprint 102 — booking review, traveler confirmation, abstract Book Now adapter workflow, and confirmation page. Extends Booking Assistant without modifying providers, search, or AI engines.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_assistant'],
    notes:
      'Product alias: booking_execution_confirmation. Additive under src/core/bookingExecutionConfirmation + UI routes /booking-assistant/*. Uses abstract adapter only.',
  },
  {
    id: 'ai.live_provider_gateway',
    name: 'Live Provider Gateway',
    description:
      'Sprint 104 — unified Provider Gateway for live provider communication (Phase 1: Amadeus). Registry, health, availability, retry/timeout/rate-limit, metrics, and error translation. Default OFF — preserves mock/legacy provider paths.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['providers.amadeus.enabled'],
    notes:
      'Product alias: live_provider_gateway. Additive under src/core/providerGateway. Does not modify engines, booking, or UI. When OFF, gateway bridge returns disabled without calling live providers.',
  },
  {
    id: 'ai.live_flight_search',
    name: 'Live Flight Search (Amadeus)',
    description:
      'Sprint 105 — first real Amadeus Flight Offers Search via Provider Gateway. Validates criteria, maps GatewayResponse into Rahhal flight offers for Decision Engine. Default OFF — legacy/mock search paths unchanged.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['providers.amadeus.enabled'],
    notes:
      'Product alias: live_flight_search. Additive under src/lib/agent/liveFlightSearch. Uses Provider Gateway + Amadeus OAuth/TravelProvider. Does not modify SearchPlanner, DecisionEngine, or UI. When OFF, runner returns disabled without calling providers.',
  },
  {
    id: 'ai.response_composer',
    name: 'AI Response Composer',
    description:
      'Sprint 106 — converts provider / Decision Engine flight facts into conversational summaries, recommendations, alternatives, confidence explanations, insights, and warnings. Default OFF — legacy response paths unchanged.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: response_composer. Additive under src/lib/agent/responseComposer. Presentation only — does not modify engines, providers, or UI. Never invents facts not present in provider data.',
  },
  {
    id: 'ai.live_hotel_search',
    name: 'Live Hotel Search (Amadeus)',
    description:
      'Sprint 109 — Amadeus Hotel Search (availability) via Provider Gateway. Validates criteria, maps GatewayResponse into HotelOffer[] with ranking groups for Decision Engine / Response Composer. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['providers.amadeus.enabled'],
    notes:
      'Product alias: live_hotel_search. Additive under src/lib/agent/liveHotelSearch + AmadeusHotelSearchProvider. Does not modify flight search, engines, or UI. Availability only — no booking.',
  },
  {
    id: 'ai.trip_builder',
    name: 'AI Trip Builder',
    description:
      'Sprint 110 — combines live flight + hotel offers into complete trip recommendations (cost, quality, confidence, rankings). Exposes Decision Engine offer pools and Response Composer packages without modifying those engines. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: trip_builder. Additive under src/lib/agent/tripBuilder. When OFF, runner returns disabled and legacy paths are unchanged.',
  },
  {
    id: 'ai.memory_engine',
    name: 'AI Memory & Personalization Engine',
    description:
      'Sprint 112 — persistent traveler preference memory, conversation memory, travel history, preference resolution/scoring. Concierge/Response Composer may consume metadata. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: memory_engine. Additive under src/lib/agent/memory/ (import via memory/index — distinct from legacy memory.ts intake helpers). Does not modify Decision Engine, providers, or Trip Builder. Recovery Phase 1 FREEZE: quarantined; sole turn owner = planTurn.',
  },
  {
    id: 'ai.orchestrator',
    name: 'AI Orchestrator',
    description:
      'Sprint 113 — additive production orchestration layer coordinating Memory → Search/Providers → Trip Builder → Decision (pass-through) → Response Composer → Concierge without modifying those engines. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: orchestrator. Additive under src/lib/agent/orchestrator. Distinct from brain.ai_orchestrator (Sprint 43) and booking.orchestrator. When OFF, legacy conversation paths are unchanged. Recovery Phase 1 FREEZE: quarantined; sole turn owner = planTurn.',
  },
  {
    id: 'ai.itinerary_engine',
    name: 'Intelligent Itinerary Engine',
    description:
      'Sprint 114 — transforms Trip Builder output into day-by-day itineraries (arrival/departure, meals, transfers, activities, conflict resolution, scoring). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: itinerary_engine. Additive under src/lib/agent/itinerary. Does not modify Trip Builder, Decision Engine, Orchestrator, or Concierge. When OFF, legacy paths are unchanged.',
  },
  {
    id: 'ai.execution_pipeline',
    name: 'Unified AI Execution Pipeline',
    description:
      'Sprint 115 — additive single-call pipeline coordinating Conversation → Memory → Search → Flights/Hotels → Decision → Trip Builder → Itinerary → Response Composer → Concierge. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: execution_pipeline. Additive under src/lib/agent/pipeline. Reuses public engine APIs only; does not rewrite engines. Distinct from ai.orchestrator (Sprint 113). When OFF, legacy behavior is unchanged. Recovery Phase 1 FREEZE: quarantined; sole turn owner = planTurn.',
  },
  {
    id: 'ai.streaming_conversation',
    name: 'AI Streaming Conversation Experience',
    description:
      'Sprint 116 — additive streaming layer that visualizes Execution Pipeline stages in real time (started/progress/completed/warning/error). Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: streaming_conversation. Additive under src/lib/agent/streaming. Wraps pipeline via public adapters only — does not modify pipeline, orchestrator, engines, or providers. When OFF, legacy behavior is unchanged. Recovery Phase 1 FREEZE: quarantined; sole turn owner = planTurn.',
  },
  {
    id: 'ai.editable_conversation',
    name: 'Editable AI Conversation',
    description:
      'Sprint 118 — additive conversation edit engine for incremental trip refinements (hotel/budget/cabin/duration/city) with partial pipeline reruns. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: editable_conversation. Additive under src/lib/agent/editing. Reuses Execution Pipeline / Streaming public APIs; does not modify engines. When OFF, legacy behavior is unchanged. Recovery Phase 1 FREEZE: quarantined; sole turn owner = planTurn.',
  },
  {
    id: 'ai.live_conversation',
    name: 'Live Conversation (Alpha alias)',
    description:
      'Sprint 103 — product alias for the live conversation experience. Maps onto the primary /chat pipeline; does not add a new conversation engine.',
    lifecycle: 'beta',
    enabled: true,
    notes:
      'Integration alias only. OFF preserves standard chat behavior. Does not gate ChatPage — informational for Alpha readiness audits.',
  },
  {
    id: 'ai.my_trips_dashboard',
    name: 'My Trips Dashboard (Alpha alias)',
    description:
      'Sprint 103 — product alias for the My Trips entry point. Maps onto ui.my_trips without replacing the existing dashboard.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.my_trips'],
    notes:
      'Integration alias only. OFF follows ui.my_trips — legacy My Trips hidden when ui.my_trips is off.',
  },
  {
    id: 'booking.orchestrator',
    name: 'Live Booking Orchestrator',
    description:
      'Sprint 94 — convert an approved bookable Trip into executable reservation workflow (validate → plan → flight hold → hotel/transfer/insurance placeholders → summary) with audit, recovery, and session state.',
    lifecycle: 'beta',
    enabled: true,
    notes:
      'Product alias: booking.orchestrator. Additive under src/core/booking. Does not modify Unified Trip or existing bookingExecution engines.',
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
    notes:
      'Requires AMADEUS_API_KEY / AMADEUS_API_SECRET (server-only; CLIENT_ID/SECRET aliases OK).',
  },
  {
    id: 'providers.amadeus.enabled',
    name: 'Amadeus Sandbox TravelProvider',
    description:
      'Sprint 92 — Amadeus Sandbox via Sprint 90 TravelProvider (flight search, OAuth, normalization). Default ON in sandbox / non-production; OFF in production unless PROVIDERS_AMADEUS_ENABLED=true.',
    lifecycle: 'beta',
    enabled: true,
    notes:
      'Product alias: providers.amadeus.enabled. Additive wrapper under src/core/amadeusSandbox. Does not modify Provider Readiness sources. No hotels.',
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
      'Sprint 57/61 — booking lifecycle, multi-domain orchestrator, live provider orders (Amadeus/Booking.com), persistence, and DocumentCenter tickets. Default ON.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_intelligence'],
    notes:
      'Product alias: booking_execution. Executes via BookingProvider/Live bridges; AMADEUS_ORDER_LIVE / BOOKING_ORDER_LIVE gate HTTP order APIs.',
  },
  {
    id: 'ai.trip_management',
    name: 'Unified Trip Management',
    description:
      'Sprint 62 — unified trips across providers: lifecycle, timeline, sync via retrieve, Document Center, search/filter/sort. Consumer of Booking Execution.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.booking_execution'],
    notes: 'Product alias: trip_management. Does not rewrite Booking Execution or providers.',
  },
  {
    id: 'ai.document_center_v2',
    name: 'Enterprise Document Center',
    description:
      'Sprint 63 — enterprise document store (e-tickets, vouchers, invoices, itinerary, passport metadata), versioning, sharing, ZIP, audit. OFF by default.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.trip_management'],
    notes:
      'Product alias: document_center_v2. Coexists with Sprint 58 payments DocumentCenter; no breaking changes when OFF.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: voice_conversation. Does not enable realtime providers. Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'voice.realtime',
    name: 'Voice Realtime Transport',
    description:
      'Sprint 18 flag for future realtime transport. Default OFF — no OpenAI/Azure/ElevenLabs I/O.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes:
      'Product alias: voice_realtime. Stubs only in Sprint 18. Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'voice.provider',
    name: 'Voice Provider Selection',
    description:
      'Sprint 18 provider abstraction gate. Default OFF; factory still resolves to mock when exercised.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes:
      'Product alias: voice_provider Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'voice.mock',
    name: 'Mock Voice Provider',
    description:
      'Sprint 18 mock voice provider harness (no audio, no fake dialogue). Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ui.voice_conversation'],
    notes:
      'Product alias: voice_mock. Only non-live provider in Sprint 18. Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'brain.enabled',
    name: 'AI Travel Brain',
    description:
      'Sprint 19 conversation intelligence orchestration layer. Default OFF — no LLM providers.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: brain_enabled Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'brain.memory',
    name: 'Brain Conversation Memory',
    description: 'Sprint 19 slot-filled conversation memory. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.enabled'],
    notes:
      'Product alias: brain_memory Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.trip_orchestrator'],
    notes:
      'Product alias: brain_context_memory. Additive to Sprint 19–27; passport/nationality only when explicitly provided; no LLM providers. Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.unified_travel_planner'],
    notes:
      'Product alias: conversation_ui. Additive chat experience — reuses planner/orchestrator/memory; does not duplicate planning or booking logic. Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.travel_execution_engine'],
    notes:
      'Product alias: payments_platform. Additive to src/lib/payment hosted checkout; does not duplicate planning/execution/booking logic. Sandbox adapters only — no live Stripe/Adyen credentials. Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.supplier_marketplace'],
    notes:
      'Product alias: finance_platform. Not a payment gateway; additive finance layer after booking/payments. Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    notes:
      'Keep VITE_PAYMENT_PROVIDER=mock until payment production freeze lifts. Recovery Phase 1 FREEZE: quarantined parallel stack.',
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
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['brain.conversation_ui'],
    notes:
      'Recovery Phase 1 FREEZE: presentation experiment; not the sole chat shell. Grouped with brain.conversation_ui.',
  },
  {
    id: 'brain.ai_orchestrator',
    name: 'Rahhal AI Orchestrator',
    description:
      'Sprint 43 central AI tool routing, planning, parallel execution, ranking, and conversational synthesis. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: [
      'brain.conversation_ui',
      'brain.finance_platform',
    ],
    notes:
      'Recovery Phase 1 FREEZE: duplicate of turn ownership. Sole turn owner = travelAgentService.planTurn. Distinct from ai.orchestrator (also frozen).',
  },
  {
    id: 'ui.chatgpt_experience',
    name: 'ChatGPT-like Conversation Experience',
    description:
      'Sprint 44 ChatGPT-quality conversation layer — memory manager, intent, response planner, tool decision, streaming UX, voice states, context recovery. Orchestrates existing engines only. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ui.conversation_experience'],
    notes:
      'Recovery Phase 1 FREEZE: disconnected from chatProviderFactory default. Sole conversation = travel-agent → planTurn.',
  },
  {
    id: 'ui.experience_v1',
    name: 'Rahhal Experience Phase 1 (UI Foundation)',
    description:
      'Sprint 119 — presentation-layer foundation under src/ui (home shell, conversation UI, cards, timeline, loading, design tokens). Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Product alias: experience_v1. Presentation only — no engine, provider, or orchestration changes. When OFF, existing pages remain unchanged. Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'ui.production_integration',
    name: 'Premium UI Production Integration',
    description:
      'Sprint 120 — connects Sprint 119 Premium UI to production Memory, Streaming, Editing, Pipeline, Trips, and Chat. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    notes:
      'Recovery Phase 1 FREEZE: disconnected from Home/Chat routing. Sole chat UI = LegacyChatPage. Quarantined under src/ui/integration.',
  },
  {
    id: 'ui.premium_home',
    name: 'Premium Home Experience',
    description:
      'Sprint 121 — polished production Home presentation sections under src/ui/home. Default OFF.',
    lifecycle: 'deprecated',
    enabled: false,
    dependsOn: ['ui.production_integration'],
    notes:
      'Product alias: premium_home. Presentation only — composes existing production home data. Does not change navigation, engines, or APIs. When OFF, ProductionHomeScreen still renders the premium sections while gated by ui.production_integration. Recovery Phase 1 FREEZE: quarantined parallel stack.',
  },
  {
    id: 'ui.application_shell',
    name: 'Premium Application Shell (Phase 4 Stage 1)',
    description:
      'Additive isolated application shell: navigation graphs, design system, theme, localization, responsive layout foundation. Not wired into production routes. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: application_shell. Framework only — no booking, search, payment, maps, or AI changes. Production unchanged when OFF.',
  },
  {
    id: 'ui.conversation_center',
    name: 'Premium AI Conversation Center (Phase 4 Stage 2)',
    description:
      'Additive isolated Conversation Center UI architecture: sidebar history, message types/cards, floating composer. Not wired into production routes, Runtime Coordinator, or Conversation Orchestrator. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: conversation_center. UI only — no AI calls, networking, speech, knowledge loading, booking, payments, or maps. Voice/Knowledge/Books are external nav placeholders only.',
  },
  {
    id: 'ui.voice_center',
    name: 'Premium Voice Conversation Center (Phase 4 Stage 3)',
    description:
      'Additive isolated Voice Center UI architecture: immersive mic stage, session states/controls, transcript, personality/settings placeholders. Own destination — not inside Chat. Not wired to AI, TTS, STT, Runtime Coordinator, or Orchestrator. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: voice_center. UI only — no Whisper/ElevenLabs/OpenAI Voice/Azure/Google Speech, no APIs, no streaming realtime. Placeholders only.',
  },
  {
    id: 'ui.knowledge_center',
    name: 'Knowledge Center (Phase 4 Stage 4)',
    description:
      'Additive isolated Knowledge Center UI architecture: guides library, dedicated books section, search/filters, reader placeholders. Own destination — not inside Chat or Voice. Not wired to AI, RAG, embeddings, search APIs, Runtime Coordinator, Orchestrator, or Voice Center. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: knowledge_center. UI only — no knowledge loading, vector DB, OCR, cloud storage, or backend. Books live only here.',
  },
  {
    id: 'ui.travel_workspace',
    name: 'Premium Travel Workspace (Phase 4 Stage 5)',
    description:
      'Additive isolated Travel Workspace UI architecture: executive dashboard, timeline, travel cards, documents, progress, quick actions. Presentation models only — not wired to production routes, AI, planning, booking, Amadeus, payments, or prior Conversation/Voice/Knowledge centers. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: travel_workspace. UI only — no APIs, backend, booking providers, or AI execution.',
  },
  {
    id: 'ui.executive_dashboard',
    name: 'Executive Dashboard + Notification Center (Phase 4 Stage 6)',
    description:
      'Additive isolated Executive Dashboard and Notification Center UI: metrics, filters, widgets, calendar placeholder, notification timeline. Presentation only — not wired to production, AI, Runtime Coordinator, Chat, Voice, Knowledge, Booking, push, realtime, or Firebase. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: executive_dashboard. UI only — no API calls, calendar sync, AI decisions, or booking.',
  },
  {
    id: 'ui.command_palette',
    name: 'Universal Search & Command Palette (Phase 4 Stage 8)',
    description:
      'Additive isolated Universal Search and Command Palette UI: global search domains, command destinations, filters, result layouts, shortcut placeholders. Presentation only — not wired to production, AI, Runtime Coordinator, Booking, Chat, Voice, Knowledge, backend search, or indexing. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: command_palette. UI only — navigation labels and local filtering; no API calls, realtime search, or AI search.',
  },
  {
    id: 'ui.journey_timeline',
    name: 'AI Journey Timeline (Phase 5 Stage 1)',
    description:
      'Additive isolated Journey Timeline UI: departure-to-return steps, event cards, smart layouts, progress. Presentation only — not wired to production, AI, Runtime Coordinator, Booking/Maps/Weather APIs, realtime, or notifications. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: journey_timeline. UI only — weather/currency/maps are placeholders; no backend or booking.',
  },
  {
    id: 'ui.decision_center',
    name: 'AI Decision Center (Phase 5 Stage 2)',
    description:
      'Additive isolated Decision Center UI: summary, alternatives, confidence, comparisons, decision tree. Presentation only — not wired to AI reasoning, Runtime, Booking, Maps, Weather, or Notifications. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: decision_center. UI only — placeholders for charts and recommendation copy; no backend or actual AI.',
  },
  {
    id: 'ui.insights_center',
    name: 'AI Insights Center (Phase 5 Stage 3)',
    description:
      'Additive isolated Insights Center UI: travel overview, statistics, budget breakdown, places, health score, badges, placeholders. Presentation only — not wired to AI, Runtime, Booking, Maps, Weather, Notifications, or analytics engines. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: insights_center. UI only — charts/heatmaps/passport/visa/loyalty/carbon are placeholders; no backend.',
  },
  {
    id: 'ui.traveler_profile',
    name: 'Traveler Profile Center (Phase 5 Stage 4)',
    description:
      'Additive isolated Traveler Profile Center UI: personal info, preferences, documents, loyalty, privacy/security placeholders. Presentation only — not wired to Auth, AI, Runtime, Booking, Maps, Weather, Firebase, Notifications, payments, or storage. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: traveler_profile. UI only — visa/boarding/payment placeholders; no backend or authentication.',
  },
  {
    id: 'ui.memory_center',
    name: 'AI Memory & Knowledge Center (Phase 5 Stage 5)',
    description:
      'Additive isolated Memory & Knowledge Center UI: timeline, destinations, preferences, rules, conversation memories, confidence, search/filters placeholders. Presentation only — not wired to AI, Runtime, Database, Firebase, Chat, auth, sync, storage, or search backends. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: memory_center. UI only — edit/delete/search are placeholders; no persistence or AI memory engine.',
  },
  {
    id: 'ui.booking_hub',
    name: 'Booking Hub (Phase 5 Stage 6)',
    description:
      'Additive isolated Booking Hub UI: trips, flights/hotels/services, documents, payments summary, timeline, calendar, map placeholder. Presentation only — not wired to AI, Booking APIs, Amadeus, Payments, Maps, Realtime, Notifications, Runtime, Database, or Firebase. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: booking_hub. UI only — search/map/payment are placeholders; no live booking.',
  },
  {
    id: 'ui.operations_center',
    name: 'Operations Center (Phase 5 Stage 7)',
    description:
      'Additive isolated Operations Center UI: active/delayed trips, queues, incidents, SLA, agent workload, audit timeline. Presentation only — not wired to AI, Runtime, Realtime, Database, Firebase, Notifications, Booking APIs, Maps, Payments, or Authentication. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: operations_center. UI only — map/charts/notifications queue are placeholders; no Runtime connection.',
  },
  {
    id: 'ui.integration_foundation',
    name: 'Integration Foundation (Phase 6 Stage 1)',
    description:
      'Additive presentation Integration Foundation: module/navigation/route registries, layout manager, module loader, shared states/tokens, developer/demo screens. Unifies UI modules without production wiring — not AI, Runtime, APIs, auth, database, booking, payments, maps, or notifications. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.application_shell'],
    notes:
      'Product alias: integration_foundation. Architecture-only — no service/API/business layers; virtual /dev routes only.',
  },
  {
    id: 'brain.conversation_orchestrator',
    name: 'AI Conversation Orchestrator Architecture (Phase 6 Stage 2)',
    description:
      'Additive architecture-only Conversation Orchestrator: intent/context/memory/reasoning/response contracts coordinating UI modules. No LLM execution, no API calls, no Runtime, no production wiring. Distinct from Phase 3 ai.conversation_orchestrator. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ui.integration_foundation'],
    notes:
      'Product alias: brain_conversation_orchestrator. Contracts/types/blueprints only — never calls OpenAI/Claude/Gemini or agent runtime.',
  },
  {
    id: 'brain.planning_engine',
    name: 'AI Planning Engine Architecture (Phase 6 Stage 3)',
    description:
      'Additive architecture-only Planning Engine: pipeline, itinerary/budget/schedule/transport/accommodation/activity planners, constraints, alternatives, confidence. Contracts/types only — no planning execution, LLM, Runtime, booking APIs, or production wiring. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['brain.conversation_orchestrator'],
    notes:
      'Product alias: brain_planning_engine. Blueprints only — never plans trips or calls providers.',
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
