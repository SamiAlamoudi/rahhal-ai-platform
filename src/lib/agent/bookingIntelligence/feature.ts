import { getFeatureRegistry } from '../../ai/featureFlags'

export const BOOKING_INTELLIGENCE_FEATURE_ID = 'ai.booking_intelligence' as const

export function isBookingIntelligenceEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('ai.booking_intelligence')
}
