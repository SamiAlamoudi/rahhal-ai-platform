/**
 * Sprint 30 — Booking.com Connectivity sandbox adapter (no production credentials).
 * Distinct from RapidAPI Booking.com live adapter (Phase W / Sprint 26).
 */

import { createSandboxHotelProvider } from '../createSandboxHotelProvider'
import type { HotelProvider } from '../HotelProvider'
import type { HotelProviderMetadata } from '../types'

export const BOOKING_CONNECTIVITY_PROVIDER_ID = 'booking_connectivity' as const

const METADATA: HotelProviderMetadata = {
  id: BOOKING_CONNECTIVITY_PROVIDER_ID,
  displayName: 'Booking.com Connectivity',
  priority: 95,
  reliability: 0.92,
  mode: 'sandbox',
  version: '1.0.0',
}

export function createBookingConnectivityAdapter(options?: {
  delayMs?: number
  failWith?: Parameters<typeof createSandboxHotelProvider>[0]['failWith']
}): HotelProvider {
  return createSandboxHotelProvider({
    metadata: METADATA,
    brand: 'Booking',
    rateLimitPerMinute: 60,
    delayMs: options?.delayMs,
    failWith: options?.failWith,
  })
}
