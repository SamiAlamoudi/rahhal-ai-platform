/**
 * Phase AB — product FeatureRegistry (distinct from Phase W provider flags).
 */

export type FeatureLifecycle = 'experimental' | 'beta' | 'stable' | 'deprecated'

export type FeatureId =
  | 'ai.multi_destination'
  | 'ai.alternative_itineraries'
  | 'ai.confidence_scoring'
  | 'ai.explainable_recommendations'
  | 'ai.preference_weighting'
  | 'ai.personalization'
  | 'ai.recommendation_engine'
  | 'ai.analytics'
  | 'ai.concierge'
  | 'ui.flight_results_experience'
  | 'ui.passenger_booking_flow'
  | 'ui.my_trips'
  | 'ui.booking_history'
  | 'ui.booking_confirmation'
  | 'ui.supplier_adapter'
  | 'ui.booking_timeline'
  | 'ui.booking_flow'
  | 'ui.order_management'
  | 'ui.checkout_review'
  | 'ui.payment_preparation'
  | 'ui.ai_home'
  | 'ui.conversation_home'
  | 'ui.travel_cards'
  | 'ui.continue_booking'
  | 'ui.smart_itinerary'
  | 'ui.travel_insights'
  | 'ui.daily_planner'
  | 'ui.voice_conversation'
  | 'voice.realtime'
  | 'voice.provider'
  | 'voice.mock'
  | 'brain.enabled'
  | 'brain.memory'
  | 'brain.intent'
  | 'brain.planner'
  | 'brain.debug'
  | 'brain.concierge'
  | 'brain.agent_handoff'
  | 'brain.voice'
  | 'brain.travel_engine'
  | 'brain.trip_planning'
  | 'brain.execution'
  | 'brain.search'
  | 'brain.real_providers'
  | 'brain.trip_orchestrator'
  | 'brain.context_memory'
  | 'brain.unified_travel_planner'
  | 'providers.hotel_foundation'
  | 'payments.live'
  | 'providers.live_master'

export interface FeatureDefinition {
  id: FeatureId
  name: string
  description: string
  lifecycle: FeatureLifecycle
  /** When false, feature is registered but inactive. */
  enabled: boolean
  /** Optional dependency feature IDs that must also be enabled. */
  dependsOn?: FeatureId[]
  /** Notes for deprecation / migration. */
  notes?: string
}

export interface FeatureRegistrySnapshot {
  features: FeatureDefinition[]
  enabledIds: FeatureId[]
}
