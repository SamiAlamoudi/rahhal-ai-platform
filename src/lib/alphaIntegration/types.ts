/**
 * Sprint 103 — Alpha Integration journey contracts (connect existing modules only).
 */

export const SPRINT103_ALPHA_INTEGRATION_VERSION = '1.0.0-alpha-integration'

export type AlphaJourneyStageId =
  | 'conversation'
  | 'planning'
  | 'search'
  | 'decision'
  | 'packages'
  | 'price_intelligence'
  | 'concierge'
  | 'alpha_experience'
  | 'booking_assistant'
  | 'booking_review'
  | 'traveler_confirmation'
  | 'book_now'
  | 'booking_execution'
  | 'confirmation'
  | 'my_trips'

export type AlphaJourneyRouteId =
  | 'new_chat'
  | 'chat'
  | 'booking'
  | 'booking_review'
  | 'booking_assistant_review'
  | 'booking_confirmation'
  | 'booking_assistant_confirmation'
  | 'my_trips'

export interface AlphaJourneyRouteDef {
  id: AlphaJourneyRouteId
  path: string
  /** Canonical target when this is an alias. */
  resolvesTo: string
  description: string
}

export interface AlphaJourneyStageDef {
  id: AlphaJourneyStageId
  label: string
  module: string
  connected: boolean
  notes: string
}

export interface AlphaIntegrationFlagReport {
  id: string
  enabled: boolean
  legacyWhenOff: string
}

export interface AlphaIntegrationDegradation {
  code:
    | 'missing_hotel'
    | 'missing_flights'
    | 'missing_package'
    | 'no_recommendation'
    | 'booking_failed'
    | 'provider_unavailable'
    | 'empty_trip'
  message: string
  hideSection: boolean
  safeFallbackRoute: string | null
}
