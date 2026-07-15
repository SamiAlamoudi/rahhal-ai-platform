import type { NormalizedFlightOffer } from '../../../../../integrations/providers/amadeus/flightNormalization'
import type { NormalizedOffer } from '../../types'

/**
 * Map normalized Amadeus flight offers into agent NormalizedOffer payloads.
 * Tool merge expects: airline, from, to, stops, price, currency, …
 * Amadeus-specific objects never leave this module / adapter boundary.
 */
export function flightOffersToNormalizedOffers(
  offers: NormalizedFlightOffer[],
  providerId: string,
): NormalizedOffer[] {
  return offers.map((offer, index) => {
    const segments = offer.itinerary.segments
    const firstSegment = segments[0]
    const lastSegment = segments[segments.length - 1]
    const from = firstSegment?.origin ?? 'XXX'
    const to = lastSegment?.destination ?? 'XXX'
    const stops = offer.itinerary.stops
    const durationHours = offer.itinerary.totalDuration > 0
      ? Math.round((offer.itinerary.totalDuration / 60) * 10) / 10
      : null
    const airline = firstSegment?.carrier || 'Airline'
    const price = Number.isFinite(offer.price) ? offer.price : null
    const currency = offer.currency || 'USD'
    const fingerprint = [
      'flight',
      from,
      to,
      stops,
      airline,
      price != null ? Math.round(price / 25) : 'na',
      offer.id,
    ].join(':')

    return {
      domain: 'flights',
      fingerprint,
      title: `${airline} ${from}→${to}`,
      price,
      currency,
      providerId,
      confidence: 0.85,
      rankScore: 0,
      scoreHints: {
        priceCompetitiveness: price != null ? clamp01(1 - price / 2000) : 0.5,
        durationQuality: durationHours != null ? clamp01(1 - durationHours / 20) : 0.6,
        relevance: 0.9 - index * 0.02,
        rating: offer.rating != null ? clamp01(offer.rating / 5) : undefined,
      },
      payload: {
        id: offer.id || `amadeus_${index}`,
        airline,
        from,
        to,
        cabin: firstSegment?.cabin || 'economy',
        stops,
        durationHours,
        price,
        currency,
        travelers: null,
        source: 'amadeus',
        departureAt: firstSegment?.departure ?? null,
        arrivalAt: lastSegment?.arrival ?? null,
      },
    }
  })
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
