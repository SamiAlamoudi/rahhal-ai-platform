/**
 * Deterministic demo flight provider — full experience without credentials.
 * Internal meta.demo = true; never label “mock” in traveler-facing copy.
 */

import { enrichMockFlight } from '../../agent/flightSearchEngine/normalize'
import type { FlightSearchProvider } from './provider'
import type {
  BilamoFlightSearchRequest,
  FlightCabinClass,
  FlightProviderHealth,
  NormalizedFlightOffer,
} from './types'

function cabinOf(raw: string | null | undefined): FlightCabinClass {
  const v = (raw || 'economy').toLowerCase()
  if (v.includes('first')) return 'first'
  if (v.includes('business')) return 'business'
  if (v.includes('premium')) return 'premium_economy'
  return 'economy'
}

function airlineName(codeOrName: string): string {
  const v = codeOrName.toLowerCase()
  if (v === 'sv' || v.includes('saud')) return 'Saudia'
  if (v === 'ek' || v.includes('emirate')) return 'Emirates'
  if (v === 'qr' || v.includes('qatar')) return 'Qatar Airways'
  if (v === 'tk' || v.includes('turkish')) return 'Turkish Airlines'
  return codeOrName
}

function buildDemoOffers(request: BilamoFlightSearchRequest): NormalizedFlightOffer[] {
  const cabin = cabinOf(request.cabin)
  const preferred = (request.preferredAirlines?.[0] || '').toLowerCase()
  const primary = preferred
    ? airlineName(preferred)
    : 'Saudia'
  const currency = (request.currency || 'SAR').toUpperCase()
  const dep = request.departureDate
  const directOnly = request.directOnly === true || request.maxStops === 0
  const fetchedAt = new Date().toISOString()

  const seeds = [
    {
      airline: primary,
      price: cabin === 'business' ? 9200 : 2890,
      stops: 0,
      duration: 620,
      departureTime: `${dep}T08:40:00Z`,
      arrivalTime: `${dep}T18:55:00Z`,
      baggage: '2 PC',
      refundable: true,
    },
    {
      airline: primary === 'Turkish Airlines' ? 'Saudia' : 'Turkish Airlines',
      price: cabin === 'business' ? 8680 : 2660,
      stops: 0,
      duration: 640,
      departureTime: `${dep}T14:10:00Z`,
      arrivalTime: `${dep}T23:50:00Z`,
      baggage: '1 PC',
      refundable: false,
    },
    {
      airline: primary === 'Emirates' ? 'Qatar Airways' : 'Emirates',
      price: cabin === 'business' ? 10500 : 2420,
      stops: 1,
      duration: 780,
      departureTime: `${dep}T01:20:00Z`,
      arrivalTime: `${dep}T14:20:00Z`,
      baggage: '2 PC',
      refundable: true,
    },
  ].filter((s) => !directOnly || s.stops === 0)

  return seeds.map((s, index) => {
    const raw = enrichMockFlight({
      origin: request.origin.toUpperCase(),
      destination: request.destination.toUpperCase(),
      currency,
      cabin,
      airline: s.airline,
      price: s.price,
      stops: s.stops,
      duration: s.duration,
      departureTime: s.departureTime,
      arrivalTime: s.arrivalTime,
      baggage: s.baggage,
      refundable: s.refundable,
    }, index)

    return {
      offerId: raw.id,
      airline: raw.airline,
      flightNumber: raw.flightNumber,
      origin: raw.origin,
      destination: raw.destination,
      departAt: raw.departureTime,
      arriveAt: raw.arrivalTime,
      durationMinutes: raw.duration,
      stops: raw.stops,
      layovers: raw.stops > 0
        ? [{ airport: 'DXB', durationMinutes: 95 }]
        : [],
      cabin,
      baggageSummary: raw.baggage,
      refundable: raw.refundable,
      changeable: raw.refundable ? true : null,
      totalPrice: raw.price,
      currency: raw.currency,
      provider: 'demo' as const,
      bookingReference: raw.bookingToken,
      deepLink: null,
      fetchedAt,
      meta: { demo: true, dataSource: 'demo' as const },
    }
  })
}

export function createDemoFlightSearchProvider(): FlightSearchProvider {
  const catalog = new Map<string, NormalizedFlightOffer>()

  return {
    providerId: 'bilamo-demo-flights',

    async searchFlights(request) {
      const started = Date.now()
      if (request.signal?.aborted) {
        return {
          ok: false,
          mode: 'demo',
          offers: [],
          error: 'cancelled',
          timedOut: false,
          rateLimited: false,
          latencyMs: 0,
        }
      }
      const offers = buildDemoOffers(request)
      for (const offer of offers) catalog.set(offer.offerId, offer)
      return {
        ok: true,
        mode: 'demo',
        offers,
        error: null,
        timedOut: false,
        rateLimited: false,
        latencyMs: Date.now() - started,
      }
    },

    async getOfferDetails(offerId) {
      const offer = catalog.get(offerId)
      if (!offer) return null
      return {
        offer,
        segments: [{
          airline: offer.airline,
          flightNumber: offer.flightNumber,
          origin: offer.origin,
          destination: offer.destination,
          departAt: offer.departAt,
          arriveAt: offer.arriveAt,
          durationMinutes: offer.durationMinutes,
        }],
      }
    },

    async healthCheck(): Promise<FlightProviderHealth> {
      return {
        ok: true,
        mode: 'demo',
        provider: 'demo',
        detail: 'Deterministic demo inventory ready',
        checkedAt: new Date().toISOString(),
      }
    },
  }
}
