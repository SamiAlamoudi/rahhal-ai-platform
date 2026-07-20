import type { FlightProvider, ProviderRequest } from '../../../utils/contracts/providers'
import type { FlightOffer } from '../../../utils/contracts/models'
import type { ProviderResult } from '../../../utils/contracts/result'
import type { ProviderCapabilities } from '../../../utils/contracts/capabilities'
import { okResult, errorResult } from '../../../utils/contracts/result'
import type { ProviderError } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { AmadeusOAuthClient } from './amadeusOAuthClient'
import {
  AmadeusFlightApiClient,
  type AmadeusFlightOffer,
  type ApiClientConfig,
} from './amadeusFlightApiClient'
import { normalizeAmadeusFlightOffer, normalizeAmadeusResponse } from './flightNormalization'
import { buildAmadeusFlightSearchQuery } from './flightSearchModule'
import { AMADEUS_DEFAULT_HOST, normalizeAmadeusHost } from './amadeusHost'
import {
  buildAmadeusBookingReadyPayload,
  type AmadeusBookingReadyPayload,
} from './bookingReadyPayload'

const METADATA: ProviderMetadata = {
  id: 'amadeus-flight-001',
  name: 'Amadeus Flight Provider',
  priority: 1,
  enabled: true,
  type: 'flight',
  version: '1.1.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsPriceTracking: true,
  supportsMultiCity: true,
}

export interface AmadeusFlightAdapterConfig {
  /** Server-side token proxy URL (Supabase Edge Function). */
  tokenUrl: string
  /** Supabase anon key / JWT used to invoke the proxy — never an Amadeus secret. */
  invokeApiKey: string
  /** Amadeus API host (e.g. https://test.api.amadeus.com). Paths use /v1/... */
  baseUrl: string
  timeout: number
  maxRetries: number
}

export interface AmadeusOfferDetailsResult {
  offer: FlightOffer
  pricedFlightOffer: AmadeusFlightOffer
  bookingReady: AmadeusBookingReadyPayload
  latency: number
}

export class AmadeusFlightAdapter implements FlightProvider {
  readonly metadata = METADATA
  private oauthClient: AmadeusOAuthClient
  private apiClient: AmadeusFlightApiClient
  private readonly host: string
  /** Raw offers from the last successful search — required for Flight Offers Price. */
  private lastRawOffers = new Map<string, AmadeusFlightOffer>()
  private lastSearchTravelers = { adults: 1, children: 0, infants: 0 }

  constructor(config: AmadeusFlightAdapterConfig) {
    this.host = normalizeAmadeusHost(config.baseUrl || AMADEUS_DEFAULT_HOST)
    this.oauthClient = new AmadeusOAuthClient({
      tokenUrl: config.tokenUrl,
      invokeApiKey: config.invokeApiKey,
      timeout: config.timeout,
    })
    const apiConfig: ApiClientConfig = {
      baseUrl: this.host,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    }
    this.apiClient = new AmadeusFlightApiClient(apiConfig, this.oauthClient)
  }

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  getOAuthClient(): AmadeusOAuthClient {
    return this.oauthClient
  }

  getApiClient(): AmadeusFlightApiClient {
    return this.apiClient
  }

  async searchFlights(req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>> {
    const start = Date.now()

    const built = await buildAmadeusFlightSearchQuery(this.apiClient, req.search, {
      // Prefer local IATA/aliases first; remote lookup only when needed.
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

    this.lastSearchTravelers = {
      adults: built.query.adults,
      children: built.query.children ?? 0,
      infants: built.query.infants ?? 0,
    }

    const result = await this.apiClient.searchFlightOffers(built.query)
    const latency = Date.now() - start

    if (result.error || !result.data) {
      return errorResult<FlightOffer[]>(
        METADATA.id,
        METADATA.name,
        result.error ? [result.error] : [{
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

    this.lastRawOffers.clear()
    for (const raw of result.data.data ?? []) {
      this.lastRawOffers.set(raw.id, raw)
    }

    const offers = normalizeAmadeusResponse(result.data, METADATA.id, { host: this.host })
    return okResult(METADATA.id, METADATA.name, offers as FlightOffer[], latency, 'amadeus')
  }

  /**
   * Offer details + confirmed pricing via Flight Offers Price.
   * Builds a booking-ready payload (no payment / no Create Orders).
   */
  async getOfferDetails(offerId: string): Promise<ProviderResult<AmadeusOfferDetailsResult>> {
    const start = Date.now()
    const raw = this.lastRawOffers.get(offerId)
    if (!raw) {
      return errorResult<AmadeusOfferDetailsResult>(
        METADATA.id,
        METADATA.name,
        [missingOfferError(offerId)],
        Date.now() - start,
        'amadeus',
      )
    }

    const priced = await this.apiClient.priceFlightOffers([raw])
    const latency = Date.now() - start
    if (priced.error || !priced.data?.data?.flightOffers?.length) {
      return errorResult<AmadeusOfferDetailsResult>(
        METADATA.id,
        METADATA.name,
        priced.error
          ? [priced.error]
          : [{
              code: 'AMADEUS_NO_DATA',
              category: 'provider',
              severity: 'error',
              message: 'No priced flight offer returned from Amadeus',
              retryable: false,
              timestamp: new Date().toISOString(),
            }],
        latency,
        'amadeus',
      )
    }

    const pricedFlightOffer = priced.data.data.flightOffers[0]
    this.lastRawOffers.set(pricedFlightOffer.id, pricedFlightOffer)
    const offer = normalizeAmadeusFlightOffer(
      pricedFlightOffer,
      priced.data.dictionaries,
      METADATA.id,
      { host: this.host },
    )
    const bookingReady = buildAmadeusBookingReadyPayload({
      providerId: METADATA.id,
      pricedFlightOffer,
      offer,
      adults: this.lastSearchTravelers.adults,
      children: this.lastSearchTravelers.children,
      infants: this.lastSearchTravelers.infants,
      host: this.host,
    })

    return okResult(
      METADATA.id,
      METADATA.name,
      { offer, pricedFlightOffer, bookingReady, latency },
      latency,
      'amadeus',
    )
  }

  /**
   * Build a booking-ready payload from a raw/priced Amadeus offer.
   * Payment is always null — Create Orders / PSP remain out of scope.
   */
  buildBookingReadyPayload(
    pricedFlightOffer: AmadeusFlightOffer,
    dictionaries?: Parameters<typeof normalizeAmadeusFlightOffer>[1],
  ): AmadeusBookingReadyPayload {
    const offer = normalizeAmadeusFlightOffer(
      pricedFlightOffer,
      dictionaries,
      METADATA.id,
      { host: this.host },
    )
    return buildAmadeusBookingReadyPayload({
      providerId: METADATA.id,
      pricedFlightOffer,
      offer,
      adults: this.lastSearchTravelers.adults,
      children: this.lastSearchTravelers.children,
      infants: this.lastSearchTravelers.infants,
      host: this.host,
    })
  }
}

function missingOfferError(offerId: string): ProviderError {
  return {
    code: 'AMADEUS_OFFER_NOT_FOUND',
    category: 'validation',
    severity: 'warning',
    message: `Offer "${offerId}" is not in the last Amadeus search cache — search again before pricing`,
    retryable: false,
    timestamp: new Date().toISOString(),
  }
}
