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
  | 'payments.live'
  | 'providers.live_master'
  /** Phase AI capability flags — all default OFF. */
  | 'live.flights'
  | 'live.hotels'
  | 'live.activities'
  | 'live.transport'
  | 'live.payments'
  /** Phase AJ capability-level flags — aliases of live.*; all default OFF. */
  | 'providers.flights.live'
  | 'providers.hotels.live'
  | 'providers.maps.live'
  | 'providers.weather.live'
  | 'providers.transport.live'
  | 'providers.activities.live'

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
