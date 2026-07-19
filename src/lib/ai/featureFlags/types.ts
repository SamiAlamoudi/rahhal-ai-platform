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
