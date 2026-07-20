import type { HotelProvider, ProviderRequest } from '../../../utils/contracts/providers'
import type { HotelOffer } from '../../../utils/contracts/models'
import type { ProviderResult } from '../../../utils/contracts/result'
import type { ProviderCapabilities } from '../../../utils/contracts/capabilities'
import { okResult, errorResult } from '../../../utils/contracts/result'
import { defaultCapabilities } from '../../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../../utils/contracts/metadata'
import { BookingComApiClient, type ApiClientConfig, type HotelSearchQuery } from './bookingComApiClient'
import { normalizeBookingComResponse, normalizeToHotelModel, type Hotel } from './hotelNormalization'
import { resolveBookingDestination } from './destinationResolution'

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

function defaultCheckIn(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 14)
  return d.toISOString().slice(0, 10)
}

function defaultCheckOut(checkIn: string, durationDays: number): string {
  const days = durationDays > 0 ? durationDays : 3
  const d = new Date(`${checkIn}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

  private async buildHotelQuery(req: ProviderRequest): Promise<{
    query: HotelSearchQuery | null
    error: ProviderResult<never>['errors'][number] | null
    resolveLatency: number
  }> {
    const search = req.search
    const resolved = await resolveBookingDestination(this.apiClient, search.destination)

    if (!resolved.destination) {
      return {
        query: null,
        error: resolved.error ?? {
          code: 'BOOKING_DEST_LOOKUP_FAILED',
          category: 'provider',
          severity: 'error',
          message: 'Destination could not be resolved',
          retryable: true,
          timestamp: new Date().toISOString(),
        },
        resolveLatency: resolved.latency,
      }
    }

    const checkIn = search.departureDate || defaultCheckIn()
    const checkOut = search.returnDate || defaultCheckOut(checkIn, search.durationDays)

    return {
      query: {
        destType: resolved.destination.destType === 'airport'
          || resolved.destination.destType === 'landmark'
          || resolved.destination.destType === 'region'
          || resolved.destination.destType === 'district'
          || resolved.destination.destType === 'hotel'
          ? resolved.destination.destType
          : 'city',
        destId: resolved.destination.destId,
        checkIn,
        checkOut,
        adults: search.travelers.adults || 1,
        children: search.travelers.children || 0,
        rooms: 1,
        currency: search.budgetCurrency || 'SAR',
        maxResults: 10,
      },
      error: null,
      resolveLatency: resolved.latency,
    }
  }

  async searchHotels(req: ProviderRequest): Promise<ProviderResult<HotelOffer[]>> {
    const start = Date.now()
    this.lastRequestAt = new Date().toISOString()

    const built = await this.buildHotelQuery(req)
    if (!built.query || built.error) {
      const latency = Date.now() - start
      this.lastLatency = latency
      this.lastError = built.error?.message ?? 'Destination lookup failed'
      this.lastResponseCount = 0
      return errorResult<HotelOffer[]>(
        METADATA.id,
        METADATA.name,
        built.error ? [built.error] : [],
        latency,
        'booking',
      )
    }

    const result = await this.apiClient.searchHotels(built.query)
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

    const offers = normalizeBookingComResponse(result.data, METADATA.id, built.query.checkIn, built.query.checkOut)
    this.lastResponseCount = offers.length
    this.lastError = null
    return okResult(METADATA.id, METADATA.name, offers, latency, 'booking')
  }

  async searchHotelsAsHotelModel(req: ProviderRequest): Promise<ProviderResult<Hotel[]>> {
    const start = Date.now()
    this.lastRequestAt = new Date().toISOString()

    const built = await this.buildHotelQuery(req)
    if (!built.query || built.error) {
      const latency = Date.now() - start
      this.lastLatency = latency
      this.lastError = built.error?.message ?? 'Destination lookup failed'
      return errorResult<Hotel[]>(
        METADATA.id,
        METADATA.name,
        built.error ? [built.error] : [],
        latency,
        'booking',
      )
    }

    const result = await this.apiClient.searchHotels(built.query)
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
