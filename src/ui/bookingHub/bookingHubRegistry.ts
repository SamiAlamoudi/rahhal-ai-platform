/**
 * Phase 5 Stage 6 — Booking Hub feature gate.
 * Flag `ui.booking_hub` default OFF.
 */

import { getFeatureRegistry } from '../../lib/ai/featureFlags'

export const BOOKING_HUB_FEATURE_ID = 'ui.booking_hub' as const

export function isBookingHubEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BOOKING_HUB_FEATURE_ID)
}

export const BookingHubRegistry = {
  featureId: BOOKING_HUB_FEATURE_ID,
  isEnabled: isBookingHubEnabled,
}
