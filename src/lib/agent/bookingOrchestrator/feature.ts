import { getFeatureRegistry } from '../../ai'

export const BOOKING_ORCHESTRATOR_FEATURE_ID = 'booking.orchestrator' as const

export function isBookingOrchestratorEnabled(options?: { enabled?: boolean }): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled('booking.orchestrator')
}
