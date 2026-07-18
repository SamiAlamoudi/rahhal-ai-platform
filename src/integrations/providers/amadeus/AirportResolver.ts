/**
 * Airport & City resolver — wraps local IATA/alias resolution and
 * Amadeus Airport & City Search (Locations API).
 */

import type { AmadeusFlightApiClient } from './amadeusFlightApiClient'
import {
  resolveAirportCode,
  resolveAirportAlias,
  parseValidIata,
  normalizeAirportQuery,
  pickBestLocation,
  type ResolvedAirport,
  type AirportResolveResult,
} from './airportResolution'

export type { ResolvedAirport, AirportResolveResult }

export interface AirportResolverOptions {
  allowRemoteLookup?: boolean
}

/**
 * Resolves free-text cities / airports to IATA codes for flight search.
 * Prefers local aliases; optionally calls Amadeus Locations when needed.
 */
export class AirportResolver {
  private readonly client: AmadeusFlightApiClient

  constructor(client: AmadeusFlightApiClient) {
    this.client = client
  }

  async resolve(
    place: string,
    options: AirportResolverOptions = {},
  ): Promise<AirportResolveResult> {
    return resolveAirportCode(this.client, place, {
      allowRemoteLookup: options.allowRemoteLookup ?? true,
    })
  }

  resolveLocal(place: string): ResolvedAirport | null {
    return resolveAirportAlias(place)
  }

  parseIata(raw: string): string | null {
    return parseValidIata(raw)
  }

  normalizeQuery(raw: string): string {
    return normalizeAirportQuery(raw)
  }
}

export {
  resolveAirportCode,
  resolveAirportAlias,
  parseValidIata,
  normalizeAirportQuery,
  pickBestLocation,
}
