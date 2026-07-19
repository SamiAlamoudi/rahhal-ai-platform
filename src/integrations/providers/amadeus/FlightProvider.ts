/**
 * Reusable Amadeus FlightProvider service.
 *
 * Flow:
 * 1. Resolve airport codes (AirportResolver)
 * 2. Search flights (AmadeusClient) — with 15-minute FlightCache
 * 3. Map + enrich airline names (FlightMapper + Airline Codes Lookup)
 * 4. Sort by best value / lowest price / shortest duration
 * 5. Return top 5 options
 *
 * Callers (FlightService) fall back to mock when this provider fails.
 * Technical errors are never shown to the end user.
 */

import type { FlightOffer } from '../../../utils/contracts/models/flight'
import type { FlightProvider as FlightProviderContract } from '../../../utils/contracts/providers/FlightProvider'
import type { ProviderRequest, ProviderCapabilities } from '../../../utils/contracts'
import type { ProviderResult } from '../../../utils/contracts/result'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { AmadeusClient, type AmadeusClientConfig } from './AmadeusClient'
import { AirportResolver } from './AirportResolver'
import {
  mapAmadeusOffers,
  selectTopFlightOptions,
  formatFlightOffersForConversation,
  type MappedFlightOffer,
  TOP_FLIGHT_OPTIONS,
} from './FlightMapper'
import {
  FlightCache,
  buildFlightCacheKey,
  type FlightCache as FlightCacheType,
} from './FlightCache'
import { buildAmadeusFlightSearchQuery } from './flightSearchModule'
import { AMADEUS_FLIGHT_PROVIDER_ID } from './amadeusSandbox'

const METADATA: ProviderMetadata = {
  id: AMADEUS_FLIGHT_PROVIDER_ID,
  name: 'Amadeus Flight Provider',
  priority: 1,
  enabled: true,
  type: 'flight',
  version: '2.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsPriceTracking: true,
  supportsMultiCity: true,
}

export interface AmadeusFlightProviderConfig extends AmadeusClientConfig {
  /** Optional dedicated cache instance (defaults to shared 15-min cache). */
  cache?: FlightCacheType<MappedFlightOffer[]>
  /** Max offers returned to the conversation / UI. */
  topN?: number
}

export interface FlightSearchPresentation {
  offers: MappedFlightOffer[]
  conversationText: string
  fromCache: boolean
  originLabel: string
  destinationLabel: string
}

export class AmadeusLiveFlightProvider implements FlightProviderContract {
  readonly metadata = METADATA
  private readonly client: AmadeusClient
  private readonly resolver: AirportResolver
  private readonly cache: FlightCacheType<MappedFlightOffer[]>
  private readonly topN: number

  constructor(config: AmadeusFlightProviderConfig) {
    this.client = new AmadeusClient(config)
    this.resolver = new AirportResolver(this.client.getApiClient())
    this.cache = config.cache ?? new FlightCache<MappedFlightOffer[]>()
    this.topN = config.topN ?? TOP_FLIGHT_OPTIONS
  }

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  getClient(): AmadeusClient {
    return this.client
  }

  getOAuthClient() {
    return this.client.getOAuthClient()
  }

  getApiClient() {
    return this.client.getApiClient()
  }

  getAirportResolver(): AirportResolver {
    return this.resolver
  }

  getCache(): FlightCacheType<MappedFlightOffer[]> {
    return this.cache
  }

  async searchFlights(req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>> {
    const start = Date.now()

    const built = await buildAmadeusFlightSearchQuery(this.client.getApiClient(), req.search, {
      allowRemoteLookup: true,
    })

    if (!built.query) {
      const latency = Date.now() - start
      return errorResult<FlightOffer[]>(
        METADATA.id,
        METADATA.name,
        built.errors,
        latency,
        'amadeus',
      )
    }

    const cacheKey = buildFlightCacheKey({
      origin: built.query.origin,
      destination: built.query.destination,
      departureDate: built.query.departureDate,
      returnDate: built.query.returnDate,
      adults: built.query.adults,
      children: built.query.children ?? 0,
      infants: built.query.infants ?? 0,
      cabin: built.query.cabin ?? '',
      currency: built.query.currency ?? 'SAR',
      nonStop: built.query.nonStop === true,
    })

    const cached = this.cache.get(cacheKey)
    if (cached) {
      const latency = Date.now() - start
      return okResult(METADATA.id, METADATA.name, cached as FlightOffer[], latency, 'amadeus')
    }

    const result = await this.client.searchFlightOffers(built.query)
    const latency = Date.now() - start

    if (result.error || !result.data) {
      return errorResult<FlightOffer[]>(
        METADATA.id,
        METADATA.name,
        result.error
          ? [result.error]
          : [{
              code: 'AMADEUS_NO_DATA',
              category: 'provider',
              severity: 'error',
              message: 'No flight data returned from Amadeus',
              retryable: false,
              timestamp: new Date().toISOString(),
            }],
        latency,
        'amadeus',
      )
    }

    let mapped = mapAmadeusOffers(result.data, METADATA.id, {
      host: this.client.host,
      returnDate: built.query.returnDate ?? req.search.returnDate ?? null,
    })

    mapped = await this.enrichAirlineNames(mapped)
    const top = selectTopFlightOptions(mapped, this.topN)
    this.cache.set(cacheKey, top)

    return okResult(METADATA.id, METADATA.name, top as FlightOffer[], latency, 'amadeus')
  }

  /**
   * Full presentation helper for conversation-first UX.
   * Returns top offers + formatted text; never throws technical details.
   */
  async searchForConversation(req: ProviderRequest): Promise<FlightSearchPresentation | null> {
    try {
      const built = await buildAmadeusFlightSearchQuery(this.client.getApiClient(), req.search, {
        allowRemoteLookup: true,
      })
      const result = await this.searchFlights(req)
      if (!result.success || !result.data || result.data.length === 0) {
        return null
      }

      const offers = result.data as MappedFlightOffer[]
      const originLabel = built.origin?.name || req.search.departureCity || offers[0]?.itinerary.segments[0]?.origin || ''
      const destinationLabel = built.destination?.name
        || req.search.destination
        || offers[0]?.itinerary.segments[offers[0].itinerary.segments.length - 1]?.destination
        || ''

      return {
        offers,
        conversationText: formatFlightOffersForConversation(offers, {
          originLabel,
          destinationLabel,
          returnDate: req.search.returnDate || null,
        }),
        fromCache: result.latency < 5,
        originLabel,
        destinationLabel,
      }
    } catch {
      return null
    }
  }

  private async enrichAirlineNames(offers: MappedFlightOffer[]): Promise<MappedFlightOffer[]> {
    const codes = [...new Set(
      offers
        .map((offer) => offer.airlineCode)
        .filter((code) => /^[A-Z0-9]{2}$/.test(code)),
    )]
    if (codes.length === 0) return offers

    try {
      const lookup = await this.client.lookupAirlines(codes)
      if (!lookup.data || lookup.data.length === 0) return offers

      const nameByCode = new Map<string, string>()
      for (const airline of lookup.data) {
        const code = (airline.iataCode || '').toUpperCase()
        const name = airline.commonName || airline.businessName
        if (code && name) nameByCode.set(code, name)
      }

      return offers.map((offer) => {
        const resolved = nameByCode.get(offer.airlineCode)
        if (!resolved) return offer
        return { ...offer, airlineName: resolved }
      })
    } catch {
      return offers
    }
  }
}

/** Alias matching the sprint naming: reusable FlightProvider service. */
export { AmadeusLiveFlightProvider as FlightProvider }

export function createAmadeusFlightProvider(
  config: AmadeusFlightProviderConfig,
): AmadeusLiveFlightProvider {
  return new AmadeusLiveFlightProvider(config)
}

export { TOP_FLIGHT_OPTIONS }
