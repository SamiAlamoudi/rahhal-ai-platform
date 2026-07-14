/**
 * Flight search module — builds an Amadeus FlightSearchQuery from a
 * TravelSearchRequest by resolving origin/destination to IATA codes.
 * Keeps airport resolution separate from hotel (Booking.com) flows.
 */

import type { TravelSearchRequest } from '../../../utils/travelSearchRequest'
import type { ProviderError } from '../../../utils/contracts/result'
import type { AmadeusFlightApiClient, FlightSearchQuery } from './amadeusFlightApiClient'
import { resolveAirportCode, type ResolvedAirport } from './airportResolution'

export interface FlightSearchBuildResult {
  query: FlightSearchQuery | null
  origin: ResolvedAirport | null
  destination: ResolvedAirport | null
  errors: ProviderError[]
  resolveLatencyMs: number
}

function defaultDepartureDate(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 14)
  return d.toISOString().slice(0, 10)
}

const CABIN_MAP: Record<string, string> = {
  economy: 'ECONOMY',
  'premium-economy': 'PREMIUM_ECONOMY',
  business: 'BUSINESS',
  first: 'FIRST',
}

export function mapCabinForApi(preferredCabin: string): string | undefined {
  if (!preferredCabin) return undefined
  return CABIN_MAP[preferredCabin] ?? undefined
}

/**
 * Resolve origin + destination airports and assemble a FlightSearchQuery.
 * Does not call flight-offers — only location resolution + query shaping.
 */
export async function buildAmadeusFlightSearchQuery(
  client: AmadeusFlightApiClient,
  search: TravelSearchRequest,
  options: { allowRemoteLookup?: boolean } = {},
): Promise<FlightSearchBuildResult> {
  const errors: ProviderError[] = []
  let resolveLatencyMs = 0

  const originResult = await resolveAirportCode(client, search.departureCity, options)
  resolveLatencyMs += originResult.latency
  if (!originResult.airport) {
    if (originResult.error) errors.push(originResult.error)
  }

  const destinationResult = await resolveAirportCode(client, search.destination, options)
  resolveLatencyMs += destinationResult.latency
  if (!destinationResult.airport) {
    if (destinationResult.error) errors.push(destinationResult.error)
  }

  if (!originResult.airport || !destinationResult.airport) {
    return {
      query: null,
      origin: originResult.airport,
      destination: destinationResult.airport,
      errors: errors.length > 0
        ? errors
        : [{
            code: 'AMADEUS_AIRPORT_RESOLVE_FAILED',
            category: 'validation',
            severity: 'error',
            message: 'Could not resolve origin and/or destination airport codes',
            retryable: false,
            timestamp: new Date().toISOString(),
          }],
      resolveLatencyMs,
    }
  }

  const query: FlightSearchQuery = {
    origin: originResult.airport.iataCode,
    destination: destinationResult.airport.iataCode,
    departureDate: search.departureDate || defaultDepartureDate(),
    adults: search.travelers.adults || 1,
    cabin: mapCabinForApi(search.preferredCabin),
    currency: search.budgetCurrency || 'SAR',
    maxResults: 10,
  }

  return {
    query,
    origin: originResult.airport,
    destination: destinationResult.airport,
    errors: [],
    resolveLatencyMs,
  }
}
