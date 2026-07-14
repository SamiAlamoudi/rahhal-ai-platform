import type { FlightProvider, FlightOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../../utils/contracts'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { AmadeusOAuthClient } from './amadeusOAuthClient'
import { AmadeusFlightApiClient, type ApiClientConfig, type FlightSearchQuery } from './amadeusFlightApiClient'
import { normalizeAmadeusResponse } from './flightNormalization'

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

const CABIN_MAP: Record<string, string> = {
  'economy': 'ECONOMY',
  'premium-economy': 'PREMIUM_ECONOMY',
  'business': 'BUSINESS',
  'first': 'FIRST',
}

function mapCabinForApi(preferredCabin: string): string | undefined {
  if (!preferredCabin) return undefined
  return CABIN_MAP[preferredCabin] ?? undefined
}

function mapOriginDestination(city: string, fallback: string): string {
  const iata = city.toUpperCase().slice(0, 3)
  if (iata.length === 3) return iata
  return fallback
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

  async searchFlights(req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>> {
    const start = Date.now()
    const search = req.search

    const query: FlightSearchQuery = {
      origin: mapOriginDestination(search.departureCity, 'RUH'),
      destination: mapOriginDestination(search.destination, 'NRT'),
      departureDate: search.departureDate || '2026-10-15',
      adults: search.travelers.adults || 1,
      cabin: mapCabinForApi(search.preferredCabin),
      currency: search.budgetCurrency || 'SAR',
      maxResults: 10,
    }

    const result = await this.apiClient.searchFlightOffers(query)
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
