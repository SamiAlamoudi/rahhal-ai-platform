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
    id: 'ai.conversation_intelligence',
    name: 'Conversation Intelligence',
    description:
      'Recovery Phase 4 — live travel memory, entity extraction, intent detection, reference resolution, smart summaries, outcome-changing questions, and travel-consultant personality. Additive soft enrich on planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: conversation_intelligence. Default OFF. Does not redesign UI or replace extractFromUserText / booking / search engines. No production API keys.',
  },
  {
    id: 'ai.llm_conversation_brain',
    name: 'LLM Conversation Brain',
    description:
      'Recovery Phase 5 — LLM-first conversation brain (mock reasoner primary; Phase 4 rules fallback): travel reasoning, tool decisions, confidence, context optimization, dialect-aware consultant replies. Additive soft enrich on planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: llm_conversation_brain. Default OFF. Production remote LLM APIs remain disabled; mock LLM path only. Uses Phase 4 conversationIntelligence as rules fallback in-process (no flag coupling). Does not redesign UI or replace search/booking engines.',
  },
  {
    id: 'ai.agent_runtime',
    name: 'AI Agent Runtime & Tool Execution',
    description:
      'Recovery Phase 6 — executable runtime connecting Conversation Intelligence + LLM Brain with mock tool adapters, lifecycle events, interruption, streaming chunks, and debug traces. Additive soft enrich on planTurn.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: agent_runtime. Default OFF. Reuses existing CI/llmBrain modules — no new reasoning layer. Mock tools only; no production API calls. Distinct from Sprint 113 ai.orchestrator.',
  },
  {
    id: 'ai.realtime_voice',
    name: 'Real AI Voice Integration',
    description:
      'Recovery Phase 7 — multi-provider realtime voice (OpenAI Realtime / Gemini Live / Azure / Web Speech / Mock) with failover, reconnect, latency metrics, and Agent Runtime incremental reasoning. Production default OFF; live sockets require VITE_VOICE_LIVE_ALLOW.',
    lifecycle: 'experimental',
    enabled: false,
    dependsOn: ['ai.concierge'],
    notes:
      'Product alias: realtime_voice. Production disabled by default. Dev opt-in via VITE_REALTIME_VOICE_DEV + VITE_VOICE_LIVE_ALLOW for sockets. Uses Agent Runtime in-process (no flag coupling). Distinct from frozen Sprint 18 ui.voice_conversation / voice.realtime. No API keys committed.',
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
    id: 'ai.integration_trip_orchestrator',
    name: 'Integration Trip Orchestrator',
    description:
      'Integration Sprint 4 — coordinates flight + hotel providers (parallel search, budget split, conflicts, itinerary, consultant summary). Does not replace providers or planTurn ownership. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_trip_orchestrator. Additive under src/lib/agent/integrationTripOrchestrator. Distinct from quarantined ai.orchestrator and brain.trip_orchestrator. When OFF, legacy planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_destination_intelligence',
    name: 'Integration Destination Intelligence',
    description:
      'Integration Sprint 5 — destination advisor layer (knowledge, matching, comparison, weather readiness mock, local transport, cost, culture). Recommends destinations without a booking request. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_destination_intelligence. Additive under src/lib/agent/integrationDestinationIntelligence. Distinct from Evolution Sprint 7 ai.destination_intelligence if present. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_trip_companion',
    name: 'Integration Live Trip Companion',
    description:
      'Integration Sprint 7 — live trip session, timeline engine, smart notifications (prepared), dynamic replanning, travel assistant, context memory, location abstraction, emergency framework. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_trip_companion. Additive under src/lib/agent/integrationTripCompanion. No live maps/GPS. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_maps_mobility',
    name: 'Integration Maps & Live Mobility',
    description:
      'Integration Sprint 8 — map provider abstraction, geocode/reverse, routes, nearby places, ETA/leave-by, spatial context. Mock provider default; live Google Maps adapter optional and not auto-enabled. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_maps_mobility. Additive under src/lib/agent/integrationMapsMobility. Reuses integrations/providers/googleMaps client when live is explicitly injected. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_budget_pricing',
    name: 'Integration Budget & Pricing Intelligence',
    description:
      'Integration Sprint 9 — BudgetEngine, cost breakdown, trade-offs, tier optimizer, flexible alternatives, cost memory, conversational budget asks. Default OFF. Distinct from Sprint 75 ai.budget_intelligence.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_budget_pricing. Additive under src/lib/agent/integrationBudgetPricing. Reuses parseBudgetUtterance and offer price hints; does not rewrite live pricing providers. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_disruption_recovery',
    name: 'Integration Live Disruption Recovery',
    description:
      'Integration Sprint 10 — DisruptionEngine, impact analyzer, recovery plans (best/cheapest/fastest/minimal/premium), auto-replan, risk scoring, live alert provider abstraction (not enabled). Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_disruption_recovery. Additive under src/lib/agent/integrationDisruptionRecovery. Distinct from brain.travel_disruption_engine. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_action_execution',
    name: 'Integration Action Execution Layer',
    description:
      'Integration Sprint 11 — ActionEngine, confirmation gate, dry-run/mock/preview execution, execution memory, Provider Runtime mock bridge. Live booking prepared but not enabled. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_action_execution. Additive under src/lib/agent/integrationActionExecution. Reuses Provider Runtime; does not rewrite providers. Distinct from ai.booking_execution. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'ai.integration_journey',
    name: 'Integration End-to-End Journey',
    description:
      'Integration Sprint 12 — JourneyEngine coordinator: shared handoff, shared decision scoring, stage traces (conversation→completion), observability. Not a new standalone feature. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: integration_journey. Additive under src/lib/agent/integrationJourney. Wraps existing integration modules via deferred soft-activate; child flags stay OFF unless enabled separately. When OFF, planTurn path is unchanged.',
  },
  {
    id: 'security.secret_manager',
    name: 'Production Secret Manager',
    description:
      'Sprint 14 — Central SecretManager / SecretProvider / EnvironmentSecretProvider. Providers obtain credentials through one secure configuration layer. Future vault backends prepared but not enabled. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: secret_manager. Additive under src/lib/security/secrets. When OFF, legacy env reads in liveProviders remain unchanged. Does not rewrite Provider Runtime, Journey, Planner, Action, Maps, Flights, Hotels, or Budget engines.',
  },
  {
    id: 'observability.platform',
    name: 'Observability Platform',
    description:
      'Sprint 15 — Centralized Logger, MetricsCollector, Tracer, HealthMonitor, EventRecorder, CorrelationIdManager. Structured logging, tracing, metrics, health checks, alert definitions. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: observability_platform. Additive under src/lib/observability. Does not modify Conversation Brain, Journey, Planner, Action, Provider Runtime, SecretManager, Maps, Flights, Hotels, or Budget. No external alerting integration yet.',
  },
  {
    id: 'load_testing.platform',
    name: 'Load Testing & Resilience Platform',
    description:
      'Sprint 16 — LoadRunner, stress profiles, failure injection, resilience validation, capacity estimation. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: load_testing_platform. Additive under src/lib/loadTesting. Simulated sessions only — does not modify Conversation Brain, Journey, Planner, Action, SecretManager, Observability Platform, or Provider Runtime.',
  },
  {
    id: 'production_audit.platform',
    name: 'Production Readiness Audit Platform',
    description:
      'Sprint 17 — Production readiness auditor, checklist, and release scorecard. Audit-only; no product behavior changes. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: production_audit_platform. Additive under src/lib/productionAudit. Does not modify Conversation Brain, UI, providers, or architecture.',
  },
  {
    id: 'rc1.validation',
    name: 'RC1 Release Candidate Validation',
    description:
      'Sprint 18 — End-to-end journey, feature-flag matrix, provider/recovery/observability/security/performance validation and GO/NO-GO. Default OFF.',
    lifecycle: 'experimental',
    enabled: false,
    notes:
      'Product alias: rc1_validation. Additive under src/lib/rc1Validation. Does not rewrite engines or merge releases.',
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
