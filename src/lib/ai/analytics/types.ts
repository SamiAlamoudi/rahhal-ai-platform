/**
 * Phase AB — anonymous product analytics foundation.
 * Must respect privacy_analytics before recording.
 */

export type AnalyticsEventName =
  | 'recommendation_shown'
  | 'recommendation_accepted'
  | 'recommendation_rejected'
  | 'itinerary_started'
  | 'itinerary_completed'
  | 'booking_funnel_view'
  | 'booking_funnel_hold'
  | 'booking_funnel_payment'
  | 'booking_funnel_ticket'
  | 'booking_funnel_complete'

export interface AnalyticsEvent {
  id: string
  name: AnalyticsEventName
  at: string
  anonymousSessionId: string
  appVersion: string | null
  metadata: Record<string, unknown>
}

export interface FunnelMetrics {
  view: number
  hold: number
  payment: number
  ticket: number
  complete: number
  conversionRate: number
}

export interface AnalyticsSnapshot {
  recommendationShown: number
  recommendationAccepted: number
  recommendationAcceptanceRate: number
  itineraryStarted: number
  itineraryCompleted: number
  itineraryCompletionRate: number
  bookingFunnel: FunnelMetrics
  eventCount: number
}
