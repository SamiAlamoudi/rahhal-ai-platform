/**
 * Sprint 53 — mock hotel provider.
 */

import { emitLiveEvent } from '../../eventBus'
import type {
  AvailabilityResult,
  BookingResult,
  CancelResult,
  HotelOffer,
  LiveProviderHealth,
  PricingResult,
  StatusResult,
} from '../../types'
import { circuitSnapshot } from '../../resilience'
import type { LiveProvider } from '../contract'
import { hashSeed, money, pick } from '../mockUtils'

const NAMES = ['Grand Central', 'Harbor Suites', 'Garden Boutique', 'Skyline Residence', 'Palm Resort']
const AMENITIES = ['pool', 'spa', 'gym', 'kids_club', 'concierge', 'airport_shuttle']

export function createMockHotelProvider(): LiveProvider<HotelOffer[]> {
  const providerId = 'mock.hotel'
  const bookings = new Map<string, { offerId: string; status: string }>()

  return {
    metadata: () => ({
      providerId,
      domain: 'hotel',
      version: '1.0.0',
      name: 'Mock Hotel Intelligence',
      mode: 'mock',
    }),

    search(query) {
      const dest = query.destination ?? 'Istanbul'
      const seed = hashSeed(`${dest}|${query.startDate ?? ''}|${query.adults ?? 2}`)
      const nights = 4
      return [0, 1, 2].map((i) => {
        const nightly = 350 + (seed % 400) + i * 180
        const available = i !== 2 || (seed % 5) !== 0
        if (!available) {
          emitLiveEvent({
            type: 'HotelUnavailable',
            domain: 'hotel',
            providerId,
            at: new Date().toISOString(),
            payload: { destination: dest, offerIndex: i },
          })
        }
        return {
          id: `htl-${seed}-${i}`,
          name: `${pick(seed + i, NAMES)} ${dest}`,
          stars: 3 + (i % 3),
          nightly: money(nightly, query.currency ?? 'SAR'),
          total: money(nightly * nights, query.currency ?? 'SAR'),
          amenities: AMENITIES.slice(0, 3 + (i % 3)),
          familySuitability: 0.55 + i * 0.12,
          luxuryScore: 0.4 + i * 0.2,
          guestRating: 7.8 + i * 0.5,
          cancellation: pick(seed + i, ['free', 'partial', 'non_refundable'] as const),
          distanceKm: 1.2 + i * 2.4,
          nearbyAttractions: [`Old Town ${dest}`, `${dest} Museum`],
          breakfast: i > 0,
          parking: i !== 1,
          internet: true,
          available,
          confidence: 0.8 + i * 0.05,
        } satisfies HotelOffer
      })
    },

    availability(_query, offerId) {
      const units = 1 + (hashSeed(offerId) % 6)
      return {
        available: units > 0,
        units,
        notes: null,
      } satisfies AvailabilityResult
    },

    pricing(query, offerId) {
      const nightly = 350 + (hashSeed(offerId) % 500)
      const taxes = Math.round(nightly * 0.15)
      return {
        price: money(nightly, query.currency ?? 'SAR'),
        taxes: money(taxes, query.currency ?? 'SAR'),
        total: money(nightly * 4 + taxes, query.currency ?? 'SAR'),
        fareClass: null,
        confidence: 0.84,
      } satisfies PricingResult
    },

    booking(_query, offerId) {
      const bookingId = `HB-${hashSeed(offerId).toString(36).toUpperCase()}`
      bookings.set(bookingId, { offerId, status: 'confirmed' })
      return {
        bookingId,
        status: 'confirmed',
        message: 'Mock hotel booking confirmed',
      } satisfies BookingResult
    },

    cancel(bookingId) {
      const row = bookings.get(bookingId)
      if (!row) {
        return { bookingId, cancelled: false, refund: null, message: 'Booking not found' }
      }
      row.status = 'cancelled'
      return {
        bookingId,
        cancelled: true,
        refund: money(200),
        message: 'Mock hotel cancelled',
      } satisfies CancelResult
    },

    status(bookingId) {
      const row = bookings.get(bookingId)
      return {
        bookingId,
        status: row?.status ?? 'unknown',
        details: { offerId: row?.offerId ?? null },
      } satisfies StatusResult
    },

    health(): LiveProviderHealth {
      const snap = circuitSnapshot(providerId)
      return {
        providerId,
        domain: 'hotel',
        healthy: snap.state !== 'open',
        circuitState: snap.state,
        lastError: snap.lastError,
        latencyMs: snap.lastLatencyMs,
      }
    },
  }
}
