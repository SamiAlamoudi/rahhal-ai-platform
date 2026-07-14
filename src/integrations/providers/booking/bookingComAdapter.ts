import type { HotelProvider, HotelOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../../utils/contracts'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { BookingComApiClient, type ApiClientConfig, type HotelSearchQuery } from './bookingComApiClient'
import { normalizeBookingComResponse, normalizeToHotelModel, type Hotel } from './hotelNormalization'

const METADATA: ProviderMetadata = {
  id: 'booking-hotel-001',
  name: 'Booking.com Hotel Provider',
  priority: 1,
  enabled: true,
  type: 'hotel',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsBooking: true,
  supportsCancellation: true,
}

export interface BookingComAdapterConfig {
  apiKey: string
  baseUrl: string
  rapidApiHost: string
  timeout: number
  maxRetries: number
}

const DEST_ID_FALLBACK = -1746443

function mapDestId(destination: string): number {
  const n = parseInt(destination, 10)
  if (!isNaN(n)) return n
  return DEST_ID_FALLBACK
}

export class BookingComAdapter implements HotelProvider {
  readonly metadata = METADATA
  private apiClient: BookingComApiClient
  private lastResponseCount: number = 0
  private lastLatency: number = 0
  private lastError: string | null = null
  private lastRequestAt: string | null = null

  constructor(config: BookingComAdapterConfig) {
    const rapidApiHost = config.rapidApiHost || 'booking-com15.p.rapidapi.com'
    const apiConfig: ApiClientConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || `https://${rapidApiHost}/api/v1`,
      rapidApiHost,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    }
    this.apiClient = new BookingComApiClient(apiConfig)
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

  async searchHotels(req: ProviderRequest): Promise<ProviderResult<HotelOffer[]>> {
    const start = Date.now()
    const search = req.search

    const query: HotelSearchQuery = {
      destType: 'city',
      destId: mapDestId(search.destination),
      checkIn: search.departureDate || '2026-10-15',
      checkOut: search.returnDate || '2026-10-25',
      adults: search.travelers.adults || 1,
      children: search.travelers.children || 0,
      rooms: 1,
      currency: search.budgetCurrency || 'SAR',
      maxResults: 10,
    }

    this.lastRequestAt = new Date().toISOString()

    const result = await this.apiClient.searchHotels(query)
    const latency = Date.now() - start
    this.lastLatency = latency

    if (result.error || !result.data) {
      this.lastError = result.error?.message ?? 'No data returned from Booking.com'
      this.lastResponseCount = 0
      return errorResult<HotelOffer[]>(
        METADATA.id,
        METADATA.name,
        result.error ? [result.error] : [{
          code: 'BOOKING_NO_DATA',
          category: 'provider',
          severity: 'error',
          message: 'No hotel data returned from Booking.com',
          retryable: false,
          timestamp: new Date().toISOString(),
        }],
        latency,
        'booking',
      )
    }

    const offers = normalizeBookingComResponse(result.data, METADATA.id, query.checkIn, query.checkOut)
    this.lastResponseCount = offers.length
    this.lastError = null
    return okResult(METADATA.id, METADATA.name, offers, latency, 'booking')
  }

  async searchHotelsAsHotelModel(req: ProviderRequest): Promise<ProviderResult<Hotel[]>> {
    const start = Date.now()
    const search = req.search

    const query: HotelSearchQuery = {
      destType: 'city',
      destId: mapDestId(search.destination),
      checkIn: search.departureDate || '2026-10-15',
      checkOut: search.returnDate || '2026-10-25',
      adults: search.travelers.adults || 1,
      children: search.travelers.children || 0,
      rooms: 1,
      currency: search.budgetCurrency || 'SAR',
      maxResults: 10,
    }

    this.lastRequestAt = new Date().toISOString()

    const result = await this.apiClient.searchHotels(query)
    const latency = Date.now() - start
    this.lastLatency = latency

    if (result.error || !result.data) {
      this.lastError = result.error?.message ?? 'No data returned from Booking.com'
      return errorResult<Hotel[]>(
        METADATA.id,
        METADATA.name,
        result.error ? [result.error] : [{
          code: 'BOOKING_NO_DATA',
          category: 'provider',
          severity: 'error',
          message: 'No hotel data returned from Booking.com',
          retryable: false,
          timestamp: new Date().toISOString(),
        }],
        latency,
        'booking',
      )
    }

    const hotels = normalizeToHotelModel(result.data, METADATA.id)
    this.lastResponseCount = hotels.length
    this.lastError = null
    return okResult(METADATA.id, METADATA.name, hotels, latency, 'booking')
  }
}
