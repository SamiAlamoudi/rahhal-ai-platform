/**
 * Sprint 105 — map GatewayResponse → Rahhal flight search offers.
 * Never expose Amadeus / provider SDK objects.
 */

import type { GatewayOffer, GatewayResponse } from '../../../core/providerGateway'
import type {
  LiveFlightSearchError,
  LiveFlightSearchResult,
  RahhalFlightSearchOffer,
} from './types'
import { SPRINT105_LIVE_FLIGHT_SEARCH_VERSION } from './types'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function bool(value: unknown): boolean {
  return value === true
}

export function mapGatewayOfferToRahhalFlight(
  offer: GatewayOffer,
): RahhalFlightSearchOffer {
  const raw = offer.raw ?? {}
  const origin = str(raw.origin) ?? ''
  const destination = str(raw.destination) ?? ''
  const airline = str(raw.airline)
  const carrierCode = str(raw.carrierCode) ?? airline
  const price = offer.price ?? num(raw.price)
  const currency = (offer.currency || str(raw.currency) || 'SAR').toUpperCase()
  const title =
    offer.title
    || [airline, origin && destination ? `${origin}→${destination}` : null]
      .filter(Boolean)
      .join(' ')
    || offer.id

  return {
    id: offer.id,
    providerId: offer.providerId,
    airline,
    carrierCode,
    price,
    currency,
    durationMinutes: num(raw.durationMinutes),
    stops: num(raw.stops),
    cabin: str(raw.cabin),
    origin,
    destination,
    departureAt: str(raw.departureAt),
    arrivalAt: str(raw.arrivalAt),
    refundable: bool(raw.refundable),
    seatsRemaining: num(raw.seatsRemaining),
    providerConfidence: num(raw.providerConfidence) ?? 0.9,
    availability: str(raw.availability),
    title,
  }
}

/** Decision-engine-ready record (plain object only). */
export function toDecisionEngineOfferRecord(
  flight: RahhalFlightSearchOffer,
): Record<string, unknown> {
  return {
    id: flight.id,
    providerId: flight.providerId,
    airline: flight.airline,
    carrierCode: flight.carrierCode,
    price: flight.price,
    currency: flight.currency,
    durationMinutes: flight.durationMinutes,
    stops: flight.stops,
    cabin: flight.cabin,
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    refundable: flight.refundable,
    seatsRemaining: flight.seatsRemaining,
    providerConfidence: flight.providerConfidence,
    availability: flight.availability,
    title: flight.title,
  }
}

export function mapGatewayError(
  response: GatewayResponse,
): LiveFlightSearchError | null {
  if (response.error) {
    const code = response.error.code.toUpperCase()
    let httpStatus: number | null = null
    if (code === 'UNAUTHORIZED' || code === 'SECRETS_MISSING') httpStatus = 401
    else if (code === 'FORBIDDEN') httpStatus = 403
    else if (code === 'NOT_FOUND') httpStatus = 404
    else if (code === 'RATE_LIMITED') httpStatus = 429
    else if (code === 'SERVER_ERROR') httpStatus = 500

    const message =
      code === 'SECRETS_MISSING' || code === 'UNAUTHORIZED'
        ? 'Amadeus authentication failed — check credentials or refresh the OAuth token.'
        : response.error.message

    return {
      code,
      message,
      retryable: response.error.retryable,
      rateLimited: response.error.rateLimited,
      timedOut: response.error.timedOut,
      httpStatus,
    }
  }

  if (response.ok && response.offers.length === 0) {
    return {
      code: 'EMPTY_RESULTS',
      message: 'No flight offers matched the search criteria.',
      retryable: false,
      rateLimited: false,
      timedOut: false,
      httpStatus: null,
    }
  }

  return null
}

export function mapGatewayResponseToLiveFlightSearch(
  response: GatewayResponse,
  partial: {
    enabled: boolean
    validationErrors?: string[]
    meta?: LiveFlightSearchResult['meta']
  },
): LiveFlightSearchResult {
  const flights = response.offers
    .filter((o) => o.kind === 'flight')
    .map(mapGatewayOfferToRahhalFlight)

  const hasFlights = flights.length > 0
  const error = mapGatewayError({
    ...response,
    offers: response.offers,
    empty: !hasFlights,
  })

  return {
    version: SPRINT105_LIVE_FLIGHT_SEARCH_VERSION,
    enabled: partial.enabled,
    ok: response.ok && hasFlights,
    empty: !hasFlights,
    flights,
    flightOffers: flights.map(toDecisionEngineOfferRecord),
    latencyMs: response.latencyMs,
    attempts: response.attempts,
    error: response.ok && hasFlights ? null : error,
    validationErrors: partial.validationErrors ?? [],
    logs: response.logs.slice(),
    meta: partial.meta ?? {
      origin: null,
      destination: null,
      departureDate: null,
      adults: null,
      children: null,
      currency: null,
      providerId: response.providerId,
      maxResults: null,
      nonStop: null,
    },
  }
}

export class LiveFlightSearchMapper {
  mapOffer(offer: GatewayOffer): RahhalFlightSearchOffer {
    return mapGatewayOfferToRahhalFlight(offer)
  }

  mapResponse(
    response: GatewayResponse,
    partial: {
      enabled: boolean
      validationErrors?: string[]
      meta?: LiveFlightSearchResult['meta']
    },
  ): LiveFlightSearchResult {
    return mapGatewayResponseToLiveFlightSearch(response, partial)
  }
}

export function createLiveFlightSearchMapper(): LiveFlightSearchMapper {
  return new LiveFlightSearchMapper()
}
