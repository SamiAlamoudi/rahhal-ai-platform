/**
 * Sprint 103 — graceful degradation helpers (no crashes on missing data).
 */

import type { AlphaIntegrationDegradation } from './types'

export function degradationForMissing(input: {
  hasFlight?: boolean
  hasHotel?: boolean
  hasPackage?: boolean
  hasRecommendation?: boolean
  bookingFailed?: boolean
  providerUnavailable?: boolean
  emptyTrip?: boolean
}): AlphaIntegrationDegradation[] {
  const out: AlphaIntegrationDegradation[] = []

  if (input.hasFlight === false) {
    out.push({
      code: 'missing_flights',
      message: 'Flight selection is not available yet.',
      hideSection: true,
      safeFallbackRoute: '/chat',
    })
  }
  if (input.hasHotel === false) {
    out.push({
      code: 'missing_hotel',
      message: 'Hotel selection is not available yet.',
      hideSection: true,
      safeFallbackRoute: '/chat',
    })
  }
  if (input.hasPackage === false) {
    out.push({
      code: 'missing_package',
      message: 'Package recommendation is not available yet.',
      hideSection: true,
      safeFallbackRoute: '/chat',
    })
  }
  if (input.hasRecommendation === false) {
    out.push({
      code: 'no_recommendation',
      message: 'No recommendation yet — continue the conversation.',
      hideSection: true,
      safeFallbackRoute: '/chat',
    })
  }
  if (input.bookingFailed) {
    out.push({
      code: 'booking_failed',
      message: 'Booking could not be completed. You can retry or return to chat.',
      hideSection: false,
      safeFallbackRoute: '/booking-assistant/review',
    })
  }
  if (input.providerUnavailable) {
    out.push({
      code: 'provider_unavailable',
      message: 'Provider is unavailable. Planning and recommendations still work with mocks.',
      hideSection: false,
      safeFallbackRoute: '/chat',
    })
  }
  if (input.emptyTrip) {
    out.push({
      code: 'empty_trip',
      message: 'No trips yet — start planning in chat.',
      hideSection: true,
      safeFallbackRoute: '/chat',
    })
  }

  return out
}

/** Safe UI copy — never throws. */
export function safeDegradationMessage(
  degradations: AlphaIntegrationDegradation[],
): string | null {
  if (degradations.length === 0) return null
  return degradations.map((d) => d.message).join(' ')
}
