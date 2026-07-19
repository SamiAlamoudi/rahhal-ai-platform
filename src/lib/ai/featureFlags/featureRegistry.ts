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
