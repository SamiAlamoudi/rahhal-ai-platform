import type { RentalCarProvider, ProviderRequest } from '../../../utils/contracts/providers'
import type { Vehicle } from '../../../utils/contracts/models'
import type { ProviderResult } from '../../../utils/contracts/result'
import type { ProviderCapabilities } from '../../../utils/contracts/capabilities'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { RentalCarsApiClient, type ApiClientConfig, type RentalCarSearchQuery } from './rentalCarsApiClient'
import { normalizeRentalCarsResponse } from './rentalCarNormalization'

const METADATA: ProviderMetadata = {
  id: 'rentalcars-001',
  name: 'Rental Cars Provider',
  priority: 3,
  enabled: true,
  type: 'rental-car',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsBooking: true,
  supportsCancellation: true,
}

export interface RentalCarsAdapterConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

export class RentalCarsComAdapter implements RentalCarProvider {
  readonly metadata = METADATA
  private apiClient: RentalCarsApiClient
  private lastResponseCount: number = 0
  private lastLatency: number = 0
  private lastError: string | null = null
  private lastRequestAt: string | null = null

  constructor(config: RentalCarsAdapterConfig) {
    const apiConfig: ApiClientConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://rentalcars-com.p.rapidapi.com/api/v1',
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    }
    this.apiClient = new RentalCarsApiClient(apiConfig)
  }

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  getDiagnostics() {
    return {
      lastResponseCount: this.lastResponseCount,
      lastLatency: this.lastLatency,
      lastError: this.lastError,
      lastRequestAt: this.lastRequestAt,
    }
  }

  async searchRentalCars(req: ProviderRequest): Promise<ProviderResult<Vehicle[]>> {
    const start = Date.now()
    const search = req.search

    const query: RentalCarSearchQuery = {
      pickupLocation: search.departureCity || search.destination || 'NRT',
      dropoffLocation: search.destination || search.departureCity || 'NRT',
      pickupDate: search.departureDate || '2026-10-15',
      dropoffDate: search.returnDate || '2026-10-25',
      pickupTime: '10:00',
      dropoffTime: '10:00',
      driverAge: 30,
      currency: search.budgetCurrency || 'SAR',
      maxResults: 10,
    }

    this.lastRequestAt = new Date().toISOString()

    const result = await this.apiClient.searchRentalCars(query)
    const latency = Date.now() - start
    this.lastLatency = latency

    if (result.error || !result.data) {
      this.lastError = result.error?.message ?? 'No data returned from Rental Cars'
      this.lastResponseCount = 0
      return errorResult<Vehicle[]>(
        METADATA.id,
        METADATA.name,
        result.error ? [result.error] : [{
          code: 'RENTAL_NO_DATA',
          category: 'provider',
          severity: 'error',
          message: 'No rental car data returned',
          retryable: false,
          timestamp: new Date().toISOString(),
        }],
        latency,
        'rentalcars',
      )
    }

    const vehicles = normalizeRentalCarsResponse(result.data, METADATA.id, query.pickupDate, query.dropoffDate)
    this.lastResponseCount = vehicles.length
    this.lastError = null
    return okResult(METADATA.id, METADATA.name, vehicles, latency, 'rentalcars')
  }
}
