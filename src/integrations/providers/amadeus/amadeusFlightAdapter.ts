import type { FlightProvider, FlightOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../../utils/contracts'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { AmadeusOAuthClient } from './amadeusOAuthClient'
import { AmadeusFlightApiClient, type ApiClientConfig } from './amadeusFlightApiClient'
import { normalizeAmadeusResponse } from './flightNormalization'
import { buildAmadeusFlightSearchQuery } from './flightSearchModule'

const METADATA: ProviderMetadata = {
  id: 'amadeus-flight-001',
  name: 'Amadeus Flight Provider',
  priority: 1,
  enabled: true,
  type: 'flight',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsPriceTracking: true,
  supportsMultiCity: true,
}

export interface AmadeusFlightAdapterConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

export class AmadeusFlightAdapter implements FlightProvider {
  readonly metadata = METADATA
  private oauthClient: AmadeusOAuthClient
  private apiClient: AmadeusFlightApiClient

  constructor(config: AmadeusFlightAdapterConfig) {
    this.oauthClient = new AmadeusOAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
    })
    const apiConfig: ApiClientConfig = {
      baseUrl: config.baseUrl,
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

    const offers = normalizeAmadeusResponse(result.data, METADATA.id)
    return okResult(METADATA.id, METADATA.name, offers as FlightOffer[], latency, 'amadeus')
  }
}
