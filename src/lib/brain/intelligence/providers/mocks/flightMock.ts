/**
 * Sprint 53 — mock flight provider (production-grade deterministic offers).
 */

import { findDestinationProfile } from '../../../../agent/reasoning/destinationCatalog'
import { emitLiveEvent } from '../../eventBus'
import type {
  AvailabilityResult,
  BookingResult,
  CancelResult,
  FlightOffer,
  LiveProviderHealth,
  PricingResult,
  StatusResult,
} from '../../types'
import { circuitSnapshot } from '../../resilience'
import type { LiveProvider } from '../contract'
import { hashSeed, money, pick } from '../mockUtils'

const AIRLINES = ['Saudia', 'flynas', 'Emirates', 'Qatar Airways', 'Turkish Airlines']
const CABINS = ['economy', 'premium_economy', 'business', 'first']
const FARES = ['Light', 'Value', 'Flex', 'Business Flex']

export function createMockFlightProvider(): LiveProvider<FlightOffer[]> {
  const providerId = 'mock.flight'
  const bookings = new Map<string, { offerId: string; status: string }>()

  const meta = {
    providerId,
    domain: 'flight' as const,
    version: '1.0.0',
    name: 'Mock Flight Intelligence',
    mode: 'mock' as const,
  }

  return {
    metadata: () => meta,

    search(query) {
      const dest = query.destination ?? 'Istanbul'
      const origin = query.origin ?? 'Riyadh'
      const profile = findDestinationProfile(dest)
      const hours = profile?.flightHoursFromRiyadh ?? 5
      const seed = hashSeed(`${origin}|${dest}|${query.startDate ?? ''}|${query.cabin ?? ''}`)
      const offers: FlightOffer[] = [0, 1, 2].map((i) => {
        const airline = pick(seed + i, AIRLINES)
        const cabin = query.cabin ?? pick(seed + i * 3, CABINS)
        const base = 900 + hours * 180 + i * 220 + (seed % 120)
        const trend = pick(seed + i, ['down', 'stable', 'up'] as const)
        if (trend === 'up' || trend === 'down') {
          emitLiveEvent({
            type: 'PriceChanged',
            domain: 'flight',
            providerId,
            at: new Date().toISOString(),
            payload: { destination: dest, trend, amount: base },
          })
        }
        return {
          id: `flt-${seed}-${i}`,
          airline,
          flightNumber: `${airline.slice(0, 2).toUpperCase()}${100 + (seed % 800) + i}`,
          origin,
          destination: dest,
          departAt: `${query.startDate ?? isoToday()}T08:0${i}:00.000Z`,
          arriveAt: `${query.startDate ?? isoToday()}T${String(8 + Math.ceil(hours) + i).padStart(2, '0')}:30:00.000Z`,
          durationMinutes: Math.round(hours * 60) + i * 35,
          layovers: i === 0 ? 0 : i,
          cabin,
          fareClass: pick(seed + i, FARES),
          seatsRemaining: 2 + ((seed + i) % 9),
          baggageKg: cabin === 'economy' ? 23 : 32,
          refundable: cabin !== 'economy' || i > 0,
          price: money(base, query.currency ?? 'SAR'),
          priceTrend: trend,
          historicalLow: money(base * 0.82, query.currency ?? 'SAR'),
          confidence: 0.78 + (i === 0 ? 0.12 : 0),
        }
      })
      return offers
    },

    availability(query, offerId) {
      const seats = 2 + (hashSeed(offerId) % 8)
      return {
        available: seats > 0,
        units: seats,
        notes: query.destination ? `Seats to ${query.destination}` : null,
      } satisfies AvailabilityResult
    },

    pricing(query, offerId) {
      const base = 900 + (hashSeed(offerId) % 700)
      const taxes = Math.round(base * 0.12)
      return {
        price: money(base, query.currency ?? 'SAR'),
        taxes: money(taxes, query.currency ?? 'SAR'),
        total: money(base + taxes, query.currency ?? 'SAR'),
        fareClass: pick(hashSeed(offerId), FARES),
        confidence: 0.86,
      } satisfies PricingResult
    },

    booking(_query, offerId) {
      const bookingId = `FB-${hashSeed(offerId).toString(36).toUpperCase()}`
      bookings.set(bookingId, { offerId, status: 'confirmed' })
      return {
        bookingId,
        status: 'confirmed',
        message: 'Mock flight booking confirmed',
      } satisfies BookingResult
    },

    cancel(bookingId) {
      const row = bookings.get(bookingId)
      if (!row) {
        return {
          bookingId,
          cancelled: false,
          refund: null,
          message: 'Booking not found',
        } satisfies CancelResult
      }
      row.status = 'cancelled'
      return {
        bookingId,
        cancelled: true,
        refund: money(400),
        message: 'Mock flight cancelled with partial refund',
      }
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
        domain: 'flight',
        healthy: snap.state !== 'open',
        circuitState: snap.state,
        lastError: snap.lastError,
        latencyMs: snap.lastLatencyMs,
      }
    },
  }
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}
