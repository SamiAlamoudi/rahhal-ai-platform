/**
 * Sprint 25 — feature flag helpers for Production Booking Flow.
 */

import { getFeatureRegistry } from '../ai'

export function isBookingFlowEnabled(options?: {
  bookingFlowEnabled?: boolean
}): boolean {
  if (typeof options?.bookingFlowEnabled === 'boolean') {
    return options.bookingFlowEnabled
  }
  return getFeatureRegistry().isEnabled('ui.booking_flow')
}
